import type { After, Ended, StatsRule, View } from '../rule'

// Records across sessions (store key `bests`), each with the day it was set
// and its owner: the session (its start time) or the day that holds it. A
// record its own owner improves grows quietly, so one long session toasts
// once, not every turn, and its owner never lowers it (a resumed session
// counts its calls from 0 again). The first value of a record is the mark to
// beat and toasts nothing.
const BESTS_KEY = 'bests'
// Lines from a session's end, toasted at the next session start.
const NEWS_KEY = 'bests-news'
const HALF_HOUR_MS = 30 * 60_000
const MINUTE_MS = 60_000

type Id = 'longest' | 'calls' | 'files' | 'cheapest'
type Best = { value: number; date: string; owner: string }
type Bests = Partial<Record<Id, Best>>

const IDS: readonly Id[] = ['longest', 'calls', 'files', 'cheapest']

const duration = (ms: number): string => {
  const minutes = Math.floor(ms / MINUTE_MS)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

const RECORDS: Record<Id, { label: string; show: (value: number) => string }> = {
  longest: { label: 'longest session', show: duration },
  calls: { label: 'most tool calls in a session', show: String },
  files: { label: 'most files edited in a day', show: String },
  cheapest: { label: 'cheapest session over 30 minutes', show: usd => `$${usd.toFixed(2)}` },
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const readBest = (raw: unknown): Best | undefined =>
  isRecord(raw) && typeof raw['value'] === 'number' && Number.isFinite(raw['value']) && raw['value'] >= 0 && typeof raw['date'] === 'string' && typeof raw['owner'] === 'string'
    ? { value: raw['value'], date: raw['date'], owner: raw['owner'] }
    : undefined

// The store is outside this code: an entry that is not a well-formed record is dropped.
const readBests = (raw: unknown): Bests =>
  Object.fromEntries(
    IDS.flatMap(id => {
      const best = readBest(isRecord(raw) ? raw[id] : undefined)
      return best === undefined ? [] : [[id, best] as const]
    }),
  )

const readNews = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((line): line is string => typeof line === 'string') : [])

type Candidate = { id: Id; value: number; owner: string }
type Judged = { bests: Bests; lines: string[] }

// The records after `candidates`, and a line for each one beaten. `beats(a, b)`
// says value a beats record b.
const judge = (bests: Bests, candidates: readonly Candidate[], date: string, beats: (a: number, b: number) => boolean): Judged =>
  candidates.reduce<Judged>(
    (so_far, { id, value, owner }) => {
      const best = so_far.bests[id]
      const next: Best = { value, date, owner }
      if (best === undefined) return { ...so_far, bests: { ...so_far.bests, [id]: next } }
      if (!beats(value, best.value)) return so_far
      if (best.owner === owner) return { ...so_far, bests: { ...so_far.bests, [id]: next } }
      const { label, show } = RECORDS[id]
      return { bests: { ...so_far.bests, [id]: next }, lines: [...so_far.lines, `${label}, ${show(value)} (was ${show(best.value)})`] }
    },
    { bests, lines: [] },
  )

const higher = (a: number, b: number): boolean => a > b
const lower = (a: number, b: number): boolean => a < b

// A nothing value (no calls yet, a session that just began) sets no mark. The
// length counts from this run, so a resumed session's time away is not in it.
const turnCandidates = (ctx: After): Candidate[] => {
  const session = ctx.startedAt === undefined ? undefined : String(ctx.startedAt)
  const all: Candidate[] = [
    ...(session === undefined ? [] : [{ id: 'longest' as const, value: ctx.now - (ctx.runStartedAt ?? ctx.startedAt ?? ctx.now), owner: session }]),
    ...(session === undefined ? [] : [{ id: 'calls' as const, value: ctx.sessionCalls ?? 0, owner: session }]),
    { id: 'files', value: ctx.days[ctx.date]?.files ?? 0, owner: ctx.date },
  ]
  return all.filter(candidate => candidate.value > 0)
}

const save = async (ctx: View, before: Bests, after: Bests): Promise<void> => {
  if (JSON.stringify(before) !== JSON.stringify(after)) await ctx.store.set(BESTS_KEY, after)
}

// At a session start: the news from the last session's end, once. On a turn:
// the session and day records.
const after = async (ctx: After): Promise<readonly string[]> => {
  if (ctx.event === 'session') {
    const lines = readNews(await ctx.store.get(NEWS_KEY))
    if (lines.length > 0) await ctx.store.set(NEWS_KEY, [])
    return lines.map(line => `New personal best last session: ${line}`)
  }
  const bests = readBests(await ctx.store.get(BESTS_KEY))
  const judged = judge(bests, turnCandidates(ctx), ctx.date, higher)
  await save(ctx, bests, judged.bests)
  return judged.lines.map(line => `New personal best: ${line}`)
}

// A session's cost only rises while it runs, so the cheapest is judged once
// it ends. A resumed session counts from its first launch, as the host says.
const ended = async (ctx: Ended): Promise<void> => {
  if (ctx.startedAt === undefined || ctx.usd === undefined || ctx.now - ctx.startedAt < HALF_HOUR_MS) return
  const bests = readBests(await ctx.store.get(BESTS_KEY))
  const judged = judge(bests, [{ id: 'cheapest', value: ctx.usd, owner: String(ctx.startedAt) }], ctx.date, lower)
  await save(ctx, bests, judged.bests)
  if (judged.lines.length > 0) await ctx.store.set(NEWS_KEY, [...readNews(await ctx.store.get(NEWS_KEY)), ...judged.lines])
}

const compose = async ({ store }: View): Promise<string> => {
  const bests = readBests(await store.get(BESTS_KEY))
  const labelWidth = Math.max(...IDS.map(id => RECORDS[id].label.length))
  const shown = IDS.map(id => {
    const best = bests[id]
    return { label: RECORDS[id].label, best, value: best === undefined ? 'not yet' : RECORDS[id].show(best.value) }
  })
  const valueWidth = Math.max(0, ...shown.filter(each => each.best !== undefined).map(each => each.value.length))
  return [
    'PERSONAL BESTS',
    ...shown.map(({ label, best, value }) =>
      best === undefined ? `${label.padEnd(labelWidth)}  ${value}` : `${label.padEnd(labelWidth)}  ${value.padEnd(valueWidth)}  ${best.date}`,
    ),
  ].join('\n')
}

export const rule: StatsRule = {
  id: 'personal-bests',
  command: { name: 'bests', description: 'List your Claude Code personal bests and when you set them', copy: false, compose },
  after,
  ended,
}
