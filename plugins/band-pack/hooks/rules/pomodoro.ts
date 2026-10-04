import type { Pomodoro } from '../../types'
import type { BandRule } from '../rule'

export const FOCUS_MS = 25 * 60_000
export const BREAK_MS = 5 * 60_000
// One tick per second is also one redraw per second at most.
export const TICK_MS = 1000

const PHASE_MS = { focus: FOCUS_MS, break: BREAK_MS } as const

// MM:SS, rounded up so the timer never reads 00:00 before it switches.
export const clockText = (ms: number): string => {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const TOAST = {
  break: 'Focus block done. Take a 5 minute break.',
  focus: 'Break over. Back to focus for 25 minutes.',
} as const

// A 25/5 focus timer. `/pomodoro` starts it and a second `/pomodoro` stops it.
// It sits in the band engine because the segment is the band's and the
// command's whole job is to move that segment; the engine runs the command
// and the interval for any rule that names a `ticker`.
export const rule: BandRule = {
  id: 'pomodoro',
  ticker: {
    command: { name: 'pomodoro', description: 'Start or stop a 25 minute focus, 5 minute break timer in the band.' },
    everyMs: TICK_MS,
    toggle: (current, now) =>
      current === null
        ? {
            next: { phase: 'focus', endsAt: now + FOCUS_MS, now },
            text: 'Pomodoro started: 25 minutes of focus. Run /pomodoro again to stop it.',
          }
        : { next: null, text: 'Pomodoro stopped.' },
    // A phase that ended gives way to the other one, measured from now: a tick
    // that came late (a sleeping laptop) does not replay the missed phases.
    tick: (current, now): { next: Pomodoro; toast?: string } => {
      if (now < current.endsAt) return { next: { ...current, now } }
      const phase = current.phase === 'focus' ? 'break' : 'focus'
      return { next: { phase, endsAt: now + PHASE_MS[phase], now }, toast: TOAST[phase] }
    },
  },
  segment: ({ pomodoro }) =>
    pomodoro === null ? undefined : { key: 'pomodoro', text: `${pomodoro.phase} ${clockText(pomodoro.endsAt - pomodoro.now)}` },
}
