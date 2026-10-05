import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { Day, Life, Pending, SessionMemo } from '../types'
import { localDate } from './date'
import { LANGS, addLangs, readLangs } from './exts'
import type { Composed, Days, StatsRule, Store, View } from './rule'
import { EMPTY_LIFE, addToDay, addToLife, prune, readDays, readLife } from './rollup'
import { EMPTY_PENDING, FRESH_SESSION, MAX_SEEN_FILES, observe } from './tracker'

// A state value is written only by the plugin that owns it, and the owner is
// the mod's name. The host wants the owner as a literal, so this source writes
// a token and scripts/build.mjs replaces it with each mod's own name
// (engine.json, nameToken).
const pending = atom({ plugin: 'personal-bests', key: 'pending' } as const, EMPTY_PENDING)
const session = atom({ plugin: 'personal-bests', key: 'session' } as const, FRESH_SESSION)

// Store keys. The rollup is `days` (one entry per local date) and `life`.
const DAYS = 'days'
const LIFE = 'life'

// What the engine needs from the host, as closures: a hook builds one from
// `$` and the engine never holds `$` itself.
type Host = {
  takePending: () => Promise<Pending>
  memo: () => Promise<SessionMemo>
  patchMemo: (fn: (memo: SessionMemo) => SessionMemo) => Promise<unknown>
  now: () => Promise<number>
  store: Store
}

// The closures a hook hands over, from which the engine derives its Host.
type Raw = {
  updatePending: (fn: (pending: Pending) => Pending) => Promise<unknown>
  readSession: () => Promise<SessionMemo>
  updateSession: (fn: (memo: SessionMemo) => SessionMemo) => Promise<unknown>
  now: () => Promise<number>
  store: Store
}

const hostOf = (raw: Raw): Host => ({
  takePending: async () => {
    let taken = EMPTY_PENDING
    await raw.updatePending(so_far => {
      taken = so_far
      return EMPTY_PENDING
    })
    return taken
  },
  memo: raw.readSession,
  patchMemo: raw.updateSession,
  now: raw.now,
  store: raw.store,
})

type Rolled = { date: string; now: number; days: Days; life: Life }

const failed = (where: string, error: unknown): string =>
  `stats: ${where} skipped, ${error instanceof Error ? error.message : String(error)}`

const attempt = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await run()
  } catch {
    return undefined
  }
}

const isEmpty = (p: Pending): boolean => p.calls === 0

// The start of this run: a resumed session keeps its first start, and the
// time it was away is not this run's.
const runStartOf = (startedAt: number, memo: SessionMemo): number => Math.max(startedAt, memo.since ?? startedAt)

// The rollup as it stands, with nothing added.
const load = async (host: Host): Promise<Rolled> => {
  const now = await host.now()
  const [days, life] = [readDays(await host.store.get(DAYS)), readLife(await host.store.get(LIFE))]
  return { date: localDate(now), now, days, life }
}

type Extra = { sessions: number; turns: number; usd?: number }

// Adds what happened since the last flush, plus `extra`, to today's entry.
//
// Idempotent: the pending counts are taken (and zeroed) atomically before the
// store is touched, so a flush that runs twice for one turn adds nothing the
// second time. The price is that a failed store write loses that one batch
// rather than adding it twice.
//
// Not atomic across sessions: `get` then `set` on one key is a read-modify-
// write and the store has no compare-and-set. Two sessions flushing in the
// same instant can lose one flush (the later `set` wins). The window is the
// two awaits between the reads and the writes, and the loss is one turn of
// one session.
//
// With `keepsLangs`, each newly counted file's type is added to `langs` too.
const flush = async (host: Host, extra: Extra, keepsLangs = false): Promise<Rolled | undefined> => {
  const taken = await host.takePending()
  if (isEmpty(taken) && extra.sessions === 0 && extra.turns === 0) return undefined

  const memo = await host.memo()
  const fresh = taken.files.filter(file => !memo.seen.includes(file))
  if (fresh.length > 0) await host.patchMemo(m => ({ ...m, seen: [...m.seen, ...fresh].slice(-MAX_SEEN_FILES) }))
  if (taken.calls > 0) await host.patchMemo(m => ({ ...m, calls: (m.calls ?? 0) + taken.calls }))

  const now = await host.now()
  const date = localDate(now)
  const delta = { ...taken, ...extra, files: fresh.length }
  const days: Record<string, Day> = prune(addToDay(readDays(await host.store.get(DAYS)), date, delta), date)
  const life = addToLife(readLife(await host.store.get(LIFE)), taken)
  await host.store.set(DAYS, days)
  await host.store.set(LIFE, life)
  if (keepsLangs && fresh.length > 0) await host.store.set(LANGS, addLangs(readLangs(await host.store.get(LANGS)), fresh))
  return { date, now, days, life }
}

export const registerStats = (on: On, rules: readonly StatsRule[]): void => {
  // Only a mod with a rule that reads file types keeps them.
  const keepsLangs = rules.some(rule => rule.langs === true)

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      await update($, pending, so_far => observe(so_far, e, ran))
    } catch (error) {
      await $.ui.log(failed(`record ${e.tool}`, error))
    }
    return ran
  })

  // The cost as the turn begins: what this turn's cost is measured from.
  on('turn.start', async ($, e, next) => {
    try {
      const usage = await $.session.usage()
      await update($, session, memo => ({ ...memo, turnStartUsd: usage.cost?.usd ?? null }))
    } catch (error) {
      await $.ui.log(failed('turn start', error))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // A subagent's turn is not the person's turn.
    if (e.agentId !== undefined) return next(e)
    try {
      // Claim the turn id first: a second end of the same turn stops here.
      let isNew = true
      await update($, session, memo => {
        isNew = memo.lastTurn !== e.turnId
        return isNew ? { ...memo, lastTurn: e.turnId } : memo
      })
      if (!isNew) return next(e)

      const usage = await attempt(() => $.session.usage())
      const usd = usage?.cost?.usd
      const memo = await read($, session)
      const base = memo.turnStartUsd ?? memo.lastUsd
      // A cost that fell (a cleared session) leaves the turn's cost unknown.
      const spent = usd !== undefined && base !== null && usd >= base ? usd - base : undefined
      await update($, session, m => ({ ...m, turnStartUsd: null, lastUsd: usd ?? m.lastUsd }))

      const host = hostOf({
        updatePending: fn => update($, pending, fn),
        readSession: () => read($, session),
        updateSession: fn => update($, session, fn),
        now: () => $.clock.now(),
        store: { get: key => $.store.get(key), set: (key, value) => $.store.set(key, value) },
      })
      const rolled = await flush(host, { sessions: 0, turns: 1, ...(spent === undefined ? {} : { usd: spent }) }, keepsLangs)
      if (rolled === undefined) return next(e)
      const latest = await read($, session)
      const sessionCalls = latest.calls ?? 0

      for (const rule of rules) {
        if (rule.after === undefined) continue
        try {
          const lines = await rule.after({
            ...rolled,
            store: host.store,
            event: 'turn',
            sessionCalls,
            promptAt: rolled.now - e.durationMs,
            ...(usage === undefined ? {} : { startedAt: usage.startedAt, runStartedAt: runStartOf(usage.startedAt, latest) }),
          })
          for (const line of lines) await $.ui.toast(line)
        } catch (error) {
          await $.ui.log(failed(rule.id, error))
        }
      }
    } catch (error) {
      await $.ui.log(failed('turn end', error))
    }
    return next(e)
  })

  // Calls of a turn that never ended (the session was closed) still count.
  on('session.end', async ($, e, next) => {
    try {
      const host = hostOf({
        updatePending: fn => update($, pending, fn),
        readSession: () => read($, session),
        updateSession: fn => update($, session, fn),
        now: () => $.clock.now(),
        store: { get: key => $.store.get(key), set: (key, value) => $.store.set(key, value) },
      })
      await flush(host, { sessions: 0, turns: 0 }, keepsLangs)
      // A /clear goes on in this process as a new session with no session.start,
      // so its tool calls count from 0 again once the ending one is judged.
      const isClear = e.reason === 'clear'
      const enders = rules.filter(rule => rule.ended !== undefined)
      if (enders.length > 0) {
        const rolled = await load(host)
        const usage = await attempt(() => $.session.usage())
        const usd = usage?.cost?.usd
        const ctx = {
          ...rolled,
          store: host.store,
          sessionCalls: (await read($, session)).calls ?? 0,
          ...(usage === undefined ? {} : { startedAt: usage.startedAt }),
          ...(usd === undefined ? {} : { usd }),
        }
        for (const rule of enders) {
          try {
            await rule.ended?.(ctx)
          } catch (error) {
            await $.ui.log(failed(rule.id, error))
          }
        }
      }
      if (isClear) await update($, session, memo => ({ ...memo, calls: 0 }))
    } catch (error) {
      await $.ui.log(failed('session end', error))
    }
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    for (const rule of rules) {
      if (rule.command === undefined) continue
      await $.command.register({ name: rule.command.name, description: rule.command.description })
    }
    try {
      const host = hostOf({
        updatePending: fn => update($, pending, fn),
        readSession: () => read($, session),
        updateSession: fn => update($, session, fn),
        now: () => $.clock.now(),
        store: { get: key => $.store.get(key), set: (key, value) => $.store.set(key, value) },
      })
      // A session is counted once, however often session.start is raised. The
      // first start this process sees is where this run began.
      const startNow = await $.clock.now()
      let isNew = true
      await update($, session, memo => {
        isNew = !memo.counted
        return isNew ? { ...memo, counted: true, since: memo.since ?? startNow } : memo
      })
      const rolled = (isNew ? await flush(host, { sessions: 1, turns: 0 }, keepsLangs) : undefined) ?? (await load(host))
      const usage = await attempt(() => $.session.usage())
      const memo = await read($, session)
      const sessionCalls = memo.calls ?? 0

      for (const rule of rules) {
        if (rule.after === undefined) continue
        try {
          const lines = await rule.after({
            ...rolled,
            store: host.store,
            event: 'session',
            sessionCalls,
            ...(usage === undefined ? {} : { startedAt: usage.startedAt, runStartedAt: runStartOf(usage.startedAt, memo) }),
          })
          for (const line of lines) await $.ui.toast(line)
        } catch (error) {
          await $.ui.log(failed(rule.id, error))
        }
      }
    } catch (error) {
      await $.ui.log(failed('session start', error))
    }
    return next(e)
  })

  for (const rule of rules) {
    const command = rule.command
    if (command === undefined) continue
    on('command.run', { command: command.name }, async ($, e) => {
      const store: Store = { get: key => $.store.get(key), set: (key, value) => $.store.set(key, value) }
      let view: View
      try {
        const now = await $.clock.now()
        const [days, life] = [readDays(await store.get(DAYS)), readLife(await store.get(LIFE))]
        view = { date: localDate(now), now, days, life, store }
      } catch (error) {
        await $.ui.log(failed(`${command.name} read`, error))
        view = { date: localDate(0), now: 0, days: {}, life: EMPTY_LIFE, store }
      }

      let composed: Composed
      try {
        composed = await command.compose(view, e.args)
      } catch (error) {
        return { text: `${command.name}: failed, ${error instanceof Error ? error.message : String(error)}` }
      }
      if (typeof composed !== 'string') return { text: composed.text }
      if (!command.copy) return { text: composed }

      const text = composed
      const copy = await attempt(() => $.ui.copy({ text }))
      const note =
        copy === undefined ? 'not copied (clipboard error)' : copy.isCopied ? 'copied to clipboard' : `not copied (${copy.reason})`
      return { text: `${text}\n\n${note}` }
    })
  }
}
