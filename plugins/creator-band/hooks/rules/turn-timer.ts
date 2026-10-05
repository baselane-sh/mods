import type { BandRule } from '../rule'

const two = (n: number): string => String(n).padStart(2, '0')

// "0:42", "12:05", "1:02:03". Whole seconds.
export const timerText = (ms: number): string => {
  const seconds = Math.floor(Math.max(0, ms) / 1000)
  const [hours, minutes] = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60)]
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds % 60)}` : `${minutes}:${two(seconds % 60)}`
}

// How long the running turn has run. The engine keeps when the turn began and
// redraws each second while it runs; between turns there is no start, so the
// segment is hidden.
export const rule: BandRule = {
  id: 'turn-timer',
  tracksTurn: true,
  segment: ({ turnStartedAt, now }) =>
    turnStartedAt === null ? undefined : { key: 'turn-timer', text: `turn ${timerText(now - turnStartedAt)}` },
}
