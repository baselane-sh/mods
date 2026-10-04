import type { Day, Life, Pending } from '../types'
import { addDays, isDate } from './date'

export const KEEP_DAYS = 400
// A day keeps this many distinct tool names; later new ones count as `other`.
const MAX_TOOLS = 25

export const EMPTY_DAY: Day = { sessions: 0, turns: 0, calls: 0, files: 0, passed: 0, failed: 0, blocked: 0, tools: {} }
export const EMPTY_LIFE: Life = { calls: 0, blocked: 0, passed: 0 }

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const readDay = (raw: unknown): Day | undefined => {
  if (!isRecord(raw)) return undefined
  const tools = isRecord(raw['tools']) ? Object.fromEntries(Object.entries(raw['tools']).map(([name, n]) => [name, count(n)])) : {}
  const usd = typeof raw['usd'] === 'number' && Number.isFinite(raw['usd']) ? raw['usd'] : undefined
  return {
    sessions: count(raw['sessions']),
    turns: count(raw['turns']),
    calls: count(raw['calls']),
    files: count(raw['files']),
    passed: count(raw['passed']),
    failed: count(raw['failed']),
    blocked: count(raw['blocked']),
    ...(usd === undefined ? {} : { usd }),
    tools,
  }
}

// The store is outside this code: anything in `days` that is not a dated,
// well-formed entry is dropped, and a missing field reads as zero.
export const readDays = (raw: unknown): Record<string, Day> => {
  if (!isRecord(raw)) return {}
  const entries = Object.entries(raw).flatMap(([date, value]) => {
    const day = isDate(date) ? readDay(value) : undefined
    return day === undefined ? [] : [[date, day] as const]
  })
  return Object.fromEntries(entries)
}

export const readLife = (raw: unknown): Life =>
  isRecord(raw) ? { calls: count(raw['calls']), blocked: count(raw['blocked']), passed: count(raw['passed']) } : EMPTY_LIFE

// What one flush adds.
export type Delta = Pick<Pending, 'calls' | 'blocked' | 'passed' | 'failed' | 'tools'> & {
  sessions: number
  turns: number
  files: number
  usd?: number
}

const mergeTools = (have: Record<string, number>, add: Record<string, number>): Record<string, number> =>
  Object.entries(add).reduce((tools, [name, n]) => {
    const key = name in tools || Object.keys(tools).length < MAX_TOOLS ? name : 'other'
    return { ...tools, [key]: (tools[key] ?? 0) + n }
  }, have)

// A new days map with `delta` added to `date`. Pure.
export const addToDay = (days: Record<string, Day>, date: string, delta: Delta): Record<string, Day> => {
  const day = days[date] ?? EMPTY_DAY
  const usd = delta.usd === undefined ? day.usd : (day.usd ?? 0) + delta.usd
  return {
    ...days,
    [date]: {
      sessions: day.sessions + delta.sessions,
      turns: day.turns + delta.turns,
      calls: day.calls + delta.calls,
      files: day.files + delta.files,
      passed: day.passed + delta.passed,
      failed: day.failed + delta.failed,
      blocked: day.blocked + delta.blocked,
      ...(usd === undefined ? {} : { usd }),
      tools: mergeTools(day.tools, delta.tools),
    },
  }
}

export const prune = (days: Record<string, Day>, today: string): Record<string, Day> => {
  const oldest = addDays(today, -KEEP_DAYS)
  return Object.fromEntries(Object.entries(days).filter(([date]) => date >= oldest))
}

export const addToLife = (life: Life, delta: Pick<Delta, 'calls' | 'blocked' | 'passed'>): Life => ({
  calls: life.calls + delta.calls,
  blocked: life.blocked + delta.blocked,
  passed: life.passed + delta.passed,
})
