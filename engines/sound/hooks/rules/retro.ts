import type { SoundRule } from '../engine'

export const rule: SoundRule = {
  id: 'retro',
  clips: {
    testPass: 'assets/retro/pass.wav',
    testFail: 'assets/retro/fail.wav',
    denied: 'assets/retro/deny.wav',
    turnDone: 'assets/retro/done.wav',
  },
}
