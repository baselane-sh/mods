import type { After, StatsRule, View } from '../rule'
import { runEndingAt } from '../streak'

const BADGES_KEY = 'badges'
const TWO_HOURS_MS = 2 * 3_600_000
const NIGHT_END_HOUR = 4

type Badge = {
  id: string
  name: string
  // Shown in the list only, for a name that does not say how to earn it.
  hint?: string
  // Whether the badge is earned, given the rollup as it stands.
  earned: (ctx: After) => boolean
}

const totalSessions = (ctx: View): number => Object.values(ctx.days).reduce((sum, day) => sum + day.sessions, 0)

export const BADGES: readonly Badge[] = [
  { id: 'first-session', name: 'First session', earned: ctx => totalSessions(ctx) > 0 },
  { id: 'first-green-test', name: 'First green test run', earned: ctx => ctx.life.passed > 0 },
  { id: 'calls-100', name: '100 tool calls', earned: ctx => ctx.life.calls >= 100 },
  { id: 'calls-1000', name: '1,000 tool calls', earned: ctx => ctx.life.calls >= 1000 },
  { id: 'streak-7', name: '7-day streak', earned: ctx => runEndingAt(ctx.days, ctx.date) >= 7 },
  { id: 'blocked-10', name: '10 blocked risky calls', earned: ctx => ctx.life.blocked >= 10 },
  {
    id: 'marathon',
    name: 'Marathon',
    hint: 'a session over 2 hours',
    earned: ctx => {
      const since = ctx.runStartedAt ?? ctx.startedAt
      return ctx.event === 'turn' && since !== undefined && ctx.now - since > TWO_HOURS_MS
    },
  },
  { id: 'night-owl', name: 'Night owl', hint: 'a turn from 00:00 to 04:00', earned: ctx => ctx.event === 'turn' && new Date(ctx.now).getHours() < NIGHT_END_HOUR },
]

// Unlocked ids with the local date they were earned.
const readBadges = (raw: unknown): Record<string, string> =>
  typeof raw !== 'object' || raw === null || Array.isArray(raw)
    ? {}
    : Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))

const compose = async ({ store }: View): Promise<string> => {
  const badges = readBadges(await store.get(BADGES_KEY))
  const have = BADGES.filter(badge => badges[badge.id] !== undefined).length
  const label = (badge: Badge): string => (badge.hint === undefined ? badge.name : `${badge.name} (${badge.hint})`)
  const width = Math.max(...BADGES.map(badge => label(badge).length))
  return [
    `ACHIEVEMENTS ${have}/${BADGES.length}`,
    ...BADGES.map(badge => {
      const date = badges[badge.id]
      return date === undefined ? `[ ] ${label(badge)}` : `[x] ${label(badge).padEnd(width)}  ${date}`
    }),
  ].join('\n')
}

// Each badge is stored once, the first time it is earned, with that date. The
// read-modify-write has the usual two-session window (the store has no atomic
// update); the worst case is a badge toasted twice, never one lost.
const after = async (ctx: After): Promise<readonly string[]> => {
  const badges = readBadges(await ctx.store.get(BADGES_KEY))
  const fresh = BADGES.filter(badge => badges[badge.id] === undefined && badge.earned(ctx))
  if (fresh.length === 0) return []
  await ctx.store.set(BADGES_KEY, { ...badges, ...Object.fromEntries(fresh.map(badge => [badge.id, ctx.date])) })
  return fresh.map(badge => `Achievement unlocked: ${badge.name}`)
}

export const rule: StatsRule = {
  id: 'achievements',
  command: { name: 'achievements', description: 'List your Claude Code badges, locked and unlocked', compose },
  after,
}
