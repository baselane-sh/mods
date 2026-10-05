import { atom, read, update } from 'claude-code'
import type { On, PluginOptions } from 'claude-code'

import type { Fetched, GitState, Outcome, Pomodoro, Reading, Tally } from '../types'
import { localDate } from './date'
import { hasFetchers, runFetchers, storeFetched } from './fetch'
import type { BandRule, Segment, TurnTokens } from './rule'
import { startTurnTimer, stopTurnTimer } from './turn'
import { bandTree, fitSegments } from './view'
import { stopMinuteTick, syncMinuteTick, tickersOf, watchCalls, watchTickers } from './watch'

// The build writes the mod's own name in place of the token: `$.state` is
// written only by the plugin that owns it, and the scan wants the atoms here.
const reading = atom({ plugin: 'error-meter', key: 'reading' } as const, null)
const turnStartUsd = atom({ plugin: 'error-meter', key: 'turnStartUsd' } as const, null)
// The state scan wants each atom spelled in the file that reads or writes it,
// so watch.ts spells the same two. A turn end replaces `reading` whole, which
// is why these live apart from it.
const outcomes = atom({ plugin: 'error-meter', key: 'outcomes' } as const, [] as readonly Outcome[])
const pomodoro = atom({ plugin: 'error-meter', key: 'pomodoro' } as const, null as Pomodoro | null)
// Written by tally.ts and git.ts, which spell the same atoms; read here to draw.
const tally = atom({ plugin: 'error-meter', key: 'tally' } as const, { calls: {}, failures: 0 } as Tally)
const git = atom({ plugin: 'error-meter', key: 'git' } as const, null as GitState | null)
// Written by the minute tick and read to draw, so the write redraws the band.
const minute = atom({ plugin: 'error-meter', key: 'minute' } as const, 0)
// Written by fetch.ts and turn.ts, which spell the same atoms; read here to draw.
const fetched = atom({ plugin: 'error-meter', key: 'fetched' } as const, {} as Readonly<Record<string, Fetched | null>>)
const turnStartedAt = atom({ plugin: 'error-meter', key: 'turnStartedAt' } as const, null as number | null)

const failed = (where: string, error: unknown): string =>
  `band: ${where} skipped, ${error instanceof Error ? error.message : String(error)}`

const segmentsOf = (rules: readonly BandRule[], draw: Parameters<BandRule['segment']>[0]): Segment[] =>
  rules.flatMap(rule => {
    try {
      const segment = rule.segment(draw)
      return segment === undefined ? [] : [segment]
    } catch {
      // A rule that throws leaves its segment out and the rest draw.
      return []
    }
  })

// The turn's cache tokens as the rules read them, or none when it had no usage.
const tokensOf = (usage: { input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number } | undefined): TurnTokens | undefined =>
  usage === undefined ? undefined : { input: usage.input_tokens, cacheRead: usage.cache_read_input_tokens, cacheWrite: usage.cache_creation_input_tokens }

const clampPercent = (percent: number | undefined): number | undefined =>
  percent === undefined || !Number.isFinite(percent) ? undefined : Math.min(100, Math.max(0, percent))

// The model is a read of its own: a failure leaves the figure out and the
// rest of the turn end stands.
const modelOf = async (read: () => Promise<string>): Promise<string | undefined> => {
  try {
    const model = (await read()).trim()
    return model === '' ? undefined : model
  } catch {
    return undefined
  }
}

export const registerBand = (on: On, rules: readonly BandRule[], options: PluginOptions): void => {
  watchCalls(on, rules)
  watchTickers(on, rules)
  const isFetching = hasFetchers(rules)
  const isMinutely = isFetching || rules.some(rule => rule.everyMinute !== undefined)
  // The band reads the minute atom, so a tick's write redraws it: each minute,
  // and each second while a turn runs.
  const isTicking = isMinutely || rules.some(rule => rule.tracksTurn === true)

  const isTurnTimed = rules.some(rule => rule.tracksTurn === true)
  const tickers = tickersOf(rules)

  // `on("session.start")` takes one hook, so it does both jobs: the slash
  // commands of the timer rules, and the first figures of the fetching rules,
  // which come with the session and not the first turn end. Not awaited: the
  // session does not wait on a command.
  if (tickers.length > 0 || isFetching) {
    on('session.start', async ($, e, next) => {
      for (const { command } of tickers) await $.command.register(command)
      if (isFetching) {
        void runFetchers(rules, 'time', {
          now: () => $.clock.now(),
          run: (argv, timeoutMs) => $.process.run(argv, { timeoutMs }),
          git: () => read($, git),
          set: (id, value) => storeFetched(change => update($, fetched, change), id, value),
          log: text => $.ui.log(text),
        })
      }
      return next(e)
    })
  }

  // The cost as the turn begins: what this turn's cost is measured from.
  on('turn.start', async ($, e, next) => {
    try {
      const usage = await $.session.usage()
      await update($, turnStartUsd, () => usage.cost?.usd ?? null)
    } catch (error) {
      await $.ui.log(failed('turn start', error))
    }
    if (isTurnTimed) {
      try {
        // The callbacks close over `$`; they never pass it on.
        await startTurnTimer({
          now: () => $.clock.now(),
          begin: at => update($, turnStartedAt, () => at),
          every: (ms, fn) => $.clock.every(ms, fn),
          tick: async () => {
            try {
              await update($, minute, n => n + 1)
            } catch (error) {
              await $.ui.log(failed('turn tick', error))
            }
          },
        })
      } catch (error) {
        await $.ui.log(failed('turn timer', error))
      }
    }
    return next(e)
  })

  // The figures are read once, here. A render hook never writes, so they go
  // into $.state for it to draw. A subagent's turn is not the person's turn.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    if (isTurnTimed) {
      // First and on its own: a failed usage read below must not leave it running.
      stopTurnTimer()
      try {
        await update($, turnStartedAt, () => null)
      } catch (error) {
        await $.ui.log(failed('turn timer', error))
      }
    }
    try {
      const usage = await $.session.usage()
      const usd = usage.cost?.usd
      const percent = clampPercent(usage.context.percent)
      const previous = await read($, reading)
      const base = (await read($, turnStartUsd)) ?? previous?.usd
      // A cost that fell (a cleared session) leaves the turn's cost unknown.
      const turnUsd = usd !== undefined && base !== undefined && usd >= base ? usd - base : undefined
      const date = localDate(await $.clock.now())
      const model = await modelOf(() => $.session.model())
      const store = {
        get: (key: string) => $.store.get(key),
        set: (key: string, value: unknown) => $.store.set(key, value),
      }

      const usageTokens = tokensOf(e.usage)
      let now: Reading = {
        ...(usd === undefined ? {} : { usd }),
        ...(turnUsd === undefined ? {} : { turnUsd }),
        ...(percent === undefined ? {} : { percent }),
        ...(Number.isFinite(usage.startedAt) ? { startedAt: usage.startedAt } : {}),
        ...(model === undefined ? {} : { model }),
      }
      for (const rule of rules) {
        if (rule.atTurnEnd === undefined) continue
        try {
          now = {
            ...now,
            ...(await rule.atTurnEnd({
              reading: now,
              previous: previous ?? {},
              ...(usageTokens === undefined ? {} : { usage: usageTokens }),
              turnUsd,
              date,
              store,
            })),
          }
        } catch (error) {
          await $.ui.log(failed(rule.id, error))
        }
      }
      await update($, reading, () => now)
      // Spent: a second end of the same turn adds nothing.
      await update($, turnStartUsd, () => null)
      if (isMinutely) {
        // The callbacks close over `$`; they never pass it on.
        const refresh = (): void => {
          if (!isFetching) return
          void runFetchers(rules, 'time', {
            now: () => $.clock.now(),
            run: (argv, timeoutMs) => $.process.run(argv, { timeoutMs }),
            git: () => read($, git),
            set: (id, value) => storeFetched(change => update($, fetched, change), id, value),
            log: text => $.ui.log(text),
          })
        }
        refresh()
        await syncMinuteTick(rules, now, {
          now: () => $.clock.now(),
          after: (ms, fn) => $.clock.after(ms, fn),
          every: (ms, fn) => $.clock.every(ms, fn),
          tick: async () => {
            try {
              refresh()
              await update($, minute, n => n + 1)
            } catch (error) {
              await $.ui.log(failed('minute', error))
            }
          },
        })
      }
    } catch (error) {
      await $.ui.log(failed('turn end', error))
    }
    return next(e)
  })

  // The tick stops with the session. A /clear or a resume goes on in this
  // process with the band still drawn, so the tick goes on too.
  if (isMinutely || isTurnTimed) {
    on('session.end', async (_$, e, next) => {
      if (e.reason !== 'clear' && e.reason !== 'resume') stopMinuteTick()
      stopTurnTimer()
      return next(e)
    })
  }

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    // A rule may draw from live state before the first turn ends.
    const current = (await read($, reading)) ?? {}
    const now = await $.clock.now()
    const date = localDate(now)
    const live = {
      outcomes: await read($, outcomes),
      pomodoro: await read($, pomodoro),
      tally: await read($, tally),
      git: await read($, git),
      fetched: await read($, fetched),
      turnStartedAt: await read($, turnStartedAt),
    }
    // Read only so its write redraws the band.
    if (isTicking) await read($, minute)
    const segments = fitSegments(segmentsOf(rules, { reading: current, options, date, now, ...live }), e.props.bodyColumns)
    if (segments.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    return bandTree({ Box, Text }, segments)
  })
}
