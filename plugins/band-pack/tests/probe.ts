import type { Mounted, TestBody } from 'claude-code/testing'
import { mock } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

// The build writes the mod's own name here: `$.state` is owned by the plugin
// that declares it, so each mod of this engine keeps its state under its name.
export const PLUGIN = 'band-pack'
export const SURFACES = ['terminal', 'desktop'] as const
export type Surface = (typeof SURFACES)[number]

// 2026-10-04 12:00 local time, so a day rollover is a fixed 12 hours away
// whatever zone the test runs in.
export const NOON = new Date(2026, 9, 4, 12, 0, 0).getTime()
export const HOUR = 3_600_000
export const TODAY_KEY = 'daily:2026-10-04'
export const TOMORROW_KEY = 'daily:2026-10-05'

export const bandProps = (bodyColumns: number, hasSurvey = false) =>
  ({
    hasSurvey,
    isWorking: false,
    maxRows: 10,
    bodyColumns,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  }) as const

export type Reading = { usd?: number; percent?: number }

export type Segment = { key: string; text: string; color?: unknown }

export type BandProbe = {
  // A whole turn: turn.start sees the cost as it stands, the turn spends,
  // then turn.complete reads the new figures.
  turn: (after: Reading) => Promise<void>
  // Only the turn.complete, with no turn.start before it.
  complete: (after: Reading, extra?: { agentId?: string }) => Promise<void>
  mount: (surface: Surface, bodyColumns?: number, hasSurvey?: boolean) => Promise<Mounted<Surface, 'AbovePrompt'>>
  segments: (ui: Mounted<Surface, 'AbovePrompt'>) => Promise<Segment[]>
  advance: (ms: number) => Promise<void>
  logs: () => readonly string[]
  // What the mod wrote to its store, by key, as written.
  writes: () => Readonly<Record<string, unknown>>
  breakUsage: () => void
}

// Stands in for the engine beneath the mod: the clock and store are the
// test kit's, `session.usage` answers `now` and a test moves it.
export const probe = (
  $: Engine,
  on: OnFn,
  start: Reading = {},
  store: Readonly<Record<string, unknown>> = {},
): BandProbe => {
  let now: Reading = start
  let isBroken = false
  let logs: string[] = []
  let turns = 0
  let written: Record<string, unknown> = {}

  const clock = mock.clock(on, { now: NOON })
  // The kit's mock.store answers the same four calls from memory, but only
  // one hook may answer each event, and these tests read the writes back.
  let kept: Record<string, unknown> = { ...store }
  on('store.get', (_$, e) => ({ value: kept[e.key] }))
  on('store.set', (_$, e) => {
    kept = { ...kept, [e.key]: e.value }
    written = { ...written, [e.key]: e.value }
    return { value: undefined }
  })
  on('store.delete', (_$, e) => {
    const { [e.key]: _gone, ...rest } = kept
    kept = rest
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(kept) }))
  on('session.usage', () => {
    if (isBroken) throw new Error('usage is down')
    return {
      value: {
        startedAt: 0,
        context: { window: 200_000, ...(now.percent === undefined ? {} : { tokens: now.percent * 2000, percent: now.percent }) },
        rateLimits: [],
        ...(now.usd === undefined ? {} : { cost: { usd: now.usd } }),
      },
    }
  })
  on('ui.log', (_$, e) => {
    logs = [...logs, e.text]
    return { value: undefined }
  })
  // What the engine draws when the band yields: something that is not the band.
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine own'] }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  const complete = async (after: Reading, extra: { agentId?: string } = {}) => {
    now = after
    turns += 1
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: `t${turns}`, reason: 'answer', ...extra })
  }

  return {
    complete,
    turn: async after => {
      await $.turn.start({ text: 'go', turnId: `t${turns + 1}` })
      await complete(after)
    },
    mount: (surface, bodyColumns = 80, hasSurvey = false) =>
      $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: bandProps(bodyColumns, hasSurvey) }),
    segments: async ui => {
      const texts = await ui.findAll({ type: 'Text' })
      return (await ui.findAll({ type: 'Box' }))
        .filter(box => box.key !== undefined && box.key !== 'band' && !box.key.startsWith('gap-'))
        .map(box => ({ key: box.key ?? '', text: box.text, color: texts.find(text => text.text === box.text)?.props.color }))
    },
    advance: ms => clock.advance(ms),
    logs: () => logs,
    writes: () => written,
    breakUsage: () => {
      isBroken = true
    },
  }
}
