import type { BandRule } from '../rule'

const two = (n: number): string => String(n).padStart(2, '0')

export const clockText = (at: number): string => {
  const date = new Date(at)
  return `${two(date.getHours())}:${two(date.getMinutes())}`
}

// "0m", "50m", "1h 5m". Whole minutes, and past a day still hours.
export const ageText = (ms: number): string => {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

// The wall clock and how long the session has run. Both come from the clock at
// each drawing, so no timer runs: the figures move whenever the screen redraws.
export const rule: BandRule = {
  id: 'session-clock',
  segment: ({ reading, now }) =>
    reading.startedAt === undefined
      ? undefined
      : { key: 'session-clock', text: `${clockText(now)} · ${ageText(now - reading.startedAt)}` },
}
