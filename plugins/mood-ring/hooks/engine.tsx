import { atom, read, update } from 'claude-code'
import type { On, PluginOptions } from 'claude-code'

import type { GitState, Outcome, Pomodoro, Reading, Tally } from '../types'
import { localDate } from './date'
import type { BandRule, Segment } from './rule'
import { bandTree, fitSegments } from './view'
import { stopMinuteTick, syncMinuteTick, watchCalls, watchTickers } from './watch'

// The build writes the mod's own name in place of the token: `$.state` is
// written only by the plugin that owns it, and the scan wants the atoms here.
const reading = atom({ plugin: 'mood-ring', key: 'reading' } as const, null)
const turnStartUsd = atom({ plugin: 'mood-ring', key: 'turnStartUsd' } as const, null)
// The state scan wants each atom spelled in the file that reads or writes it,
// so watch.ts spells the same two. A turn end replaces `reading` whole, which
// is why these live apart from it.
const outcomes = atom({ plugin: 'mood-ring', key: 'outcomes' } as const, [] as readonly Outcome[])
const pomodoro = atom({ plugin: 'mood-ring', key: 'pomodoro' } as const, null as Pomodoro | null)
// Written by tally.ts and git.ts, which spell the same atoms; read here to draw.
const tally = atom({ plugin: 'mood-ring', key: 'tally' } as const, { calls: {}, failures: 0 } as Tally)
const git = atom({ plugin: 'mood-ring', key: 'git' } as const, null as GitState | null)
// Written by the minute tick and read to draw, so the write redraws the band.
const minute = atom({ plugin: 'mood-ring', key: 'minute' } as const, 0)

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
  const isMinutely = rules.some(rule => rule.everyMinute !== undefined)

  // The cost as the turn begins: what this turn's cost is measured from.
  on('turn.start', async ($, e, next) => {
    try {
      const usage = await $.session.usage()
      await update($, turnStartUsd, () => usage.cost?.usd ?? null)
    } catch (error) {
      await $.ui.log(failed('turn start', error))
    }
    return next(e)
  })

  // The figures are read once, here. A render hook never writes, so they go
  // into $.state for it to draw. A subagent's turn is not the person's turn.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
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
          now = { ...now, ...(await rule.atTurnEnd({ reading: now, turnUsd, date, store })) }
        } catch (error) {
          await $.ui.log(failed(rule.id, error))
        }
      }
      await update($, reading, () => now)
      // Spent: a second end of the same turn adds nothing.
      await update($, turnStartUsd, () => null)
      if (isMinutely) {
        // The callbacks close over `$`; they never pass it on.
        await syncMinuteTick(rules, now, {
          now: () => $.clock.now(),
          after: (ms, fn) => $.clock.after(ms, fn),
          every: (ms, fn) => $.clock.every(ms, fn),
          tick: async () => {
            try {
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
  if (isMinutely) {
    on('session.end', async (_$, e, next) => {
      if (e.reason !== 'clear' && e.reason !== 'resume') stopMinuteTick()
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
    }
    // Read only so its write redraws the band.
    if (isMinutely) await read($, minute)
    const segments = fitSegments(segmentsOf(rules, { reading: current, options, date, now, ...live }), e.props.bodyColumns)
    if (segments.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    return bandTree({ Box, Text }, segments)
  })
}
