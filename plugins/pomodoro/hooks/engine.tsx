import { atom, read, update } from 'claude-code'
import type { Frozen, On, PluginOptions, SessionUsage, TurnCompleteInput } from 'claude-code'

import type { Fetched, GitState, Outcome, Pomodoro, Reading, Tally } from '../types'
import { localDate } from './date'
import { hasFetchers } from './fetch'
import { syncMinuteTick } from './minute'
import type { MinuteDeps } from './minute'
import type { BandRule, Segment, Ticker, TurnEnd, TurnTokens } from './rule'
import { startTurnTimer, stopTurnTimer } from './turn'
import { bandTree, fitSegments } from './view'

// The build writes the mod's own name in place of the token: `$.state` is
// written only by the plugin that owns it, and the scan wants the atoms here.
const reading = atom({ plugin: 'pomodoro', key: 'reading' } as const, null)
const turnStartUsd = atom({ plugin: 'pomodoro', key: 'turnStartUsd' } as const, null)
// The state scan wants each atom spelled in the file that reads or writes it,
// so watch.ts spells the same two. A turn end replaces `reading` whole, which
// is why these live apart from it.
const outcomes = atom({ plugin: 'pomodoro', key: 'outcomes' } as const, [] as readonly Outcome[])
const pomodoro = atom({ plugin: 'pomodoro', key: 'pomodoro' } as const, null as Pomodoro | null)
// Written by tally.ts and git.ts, which spell the same atoms; read here to draw.
const tally = atom({ plugin: 'pomodoro', key: 'tally' } as const, { calls: {}, failures: 0 } as Tally)
const git = atom({ plugin: 'pomodoro', key: 'git' } as const, null as GitState | null)
// Written by the minute tick and read to draw, so the write redraws the band.
const minute = atom({ plugin: 'pomodoro', key: 'minute' } as const, 0)
// Written by fetch.ts and turn.ts, which spell the same atoms; read here to draw.
const fetched = atom({ plugin: 'pomodoro', key: 'fetched' } as const, {} as Readonly<Record<string, Fetched | null>>)
const turnStartedAt = atom({ plugin: 'pomodoro', key: 'turnStartedAt' } as const, null as number | null)

export const failed = (where: string, error: unknown): string =>
  `band: ${where} skipped, ${error instanceof Error ? error.message : String(error)}`

export const tickersOf = (rules: readonly BandRule[]): Ticker[] =>
  rules.flatMap(rule => (rule.ticker === undefined ? [] : [rule.ticker]))

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

// The tools a turn-end host does not give. A rule that calls one is logged and
// skipped, and its tests fail: name what it uses in engine.json `needs`.
const absent = (name: string) => (): Promise<never> =>
  Promise.reject(new Error(`${name} is not given to this mod; name it in engine.json needs`))

export const NO_MODEL: TurnIo['model'] = absent('model')
export const NO_STORE: TurnIo['store'] = { get: absent('store'), set: absent('store') }

// What a turn end reads and writes, as closures over the hook's `$`.
// `refresh` runs the fetchers; only the host that runs programs gives it.
export type TurnIo = {
  usage: () => Promise<SessionUsage>
  reading: () => Promise<Reading | null>
  turnStartUsd: () => Promise<number | null>
  keep: (now: Reading) => Promise<unknown>
  spend: () => Promise<unknown>
  endTimer: () => Promise<unknown>
  model: () => Promise<string>
  store: TurnEnd['store']
  clock: Omit<MinuteDeps, 'tick'>
  redraw: () => Promise<unknown>
  log: (text: string) => unknown
  refresh?: () => void
}

// The figures are read once, at the turn's end. A render hook never writes,
// so they go into $.state for it to draw. A subagent's turn is not the
// person's turn.
export const turnComplete = async (rules: readonly BandRule[], e: Frozen<TurnCompleteInput>, io: TurnIo): Promise<void> => {
  if (e.agentId !== undefined) return
  const isFetching = hasFetchers(rules)
  const isMinutely = isFetching || rules.some(rule => rule.everyMinute !== undefined)
  if (rules.some(rule => rule.tracksTurn === true)) {
    // First and on its own: a failed usage read below must not leave it running.
    stopTurnTimer()
    try {
      await io.endTimer()
    } catch (error) {
      await io.log(failed('turn timer', error))
    }
  }
  try {
    const usage = await io.usage()
    const usd = usage.cost?.usd
    const percent = clampPercent(usage.context.percent)
    const previous = await io.reading()
    const base = (await io.turnStartUsd()) ?? previous?.usd
    // A cost that fell (a cleared session) leaves the turn's cost unknown.
    const turnUsd = usd !== undefined && base !== undefined && usd >= base ? usd - base : undefined
    const date = localDate(await io.clock.now())
    const model = await modelOf(io.model)

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
            store: io.store,
          })),
        }
      } catch (error) {
        await io.log(failed(rule.id, error))
      }
    }
    await io.keep(now)
    // Spent: a second end of the same turn adds nothing.
    await io.spend()
    if (isMinutely) {
      const refresh = (): void => {
        if (isFetching) io.refresh?.()
      }
      refresh()
      await syncMinuteTick(rules, now, {
        ...io.clock,
        tick: async () => {
          try {
            refresh()
            await io.redraw()
          } catch (error) {
            await io.log(failed('minute', error))
          }
        },
      })
    }
  } catch (error) {
    await io.log(failed('turn end', error))
  }
}

// The hooks every band mod has: the cost as the turn begins, and the band.
// The rest are hosts (engine.json), so a mod has only what its rules use.
export const registerBand = (on: On, rules: readonly BandRule[], options: PluginOptions): void => {
  const isMinutely = hasFetchers(rules) || rules.some(rule => rule.everyMinute !== undefined)
  const isTurnTimed = rules.some(rule => rule.tracksTurn === true)
  // The band reads the minute atom, so a tick's write redraws it: each minute,
  // and each second while a turn runs.
  const isTicking = isMinutely || isTurnTimed

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
