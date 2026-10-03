import type { Nudge } from '../engine'

// Session hygiene: at turn end, when the context window is at or above the
// threshold, reminds the person to /clear or /compact.
export const THRESHOLD = 75

export const create = (): Nudge => ({
  id: 'ctx-nudge',
  atStop: async tools => {
    const percent = await tools.contextPercent()
    return percent !== undefined && percent >= THRESHOLD
      ? `Context ${percent}%. Consider /clear for a new task or /compact to keep going.`
      : undefined
  },
})
