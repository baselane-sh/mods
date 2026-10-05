import type { SoundRule } from '../engine'

// One chime, for one event: a `bd close` (or `bd done`) that ended with exit 0.
// The bell is the zen pack's pass bell, copied (a rule's assets are its own).
export const rule: SoundRule = {
  id: 'bead-chime',
  clips: { beadClosed: 'assets/bead-chime/chime.wav' },
}
