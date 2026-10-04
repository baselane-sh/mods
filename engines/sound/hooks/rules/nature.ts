import type { SoundRule } from '../engine'

export const rule: SoundRule = {
  id: 'nature',
  clips: {
    testPass: 'assets/nature/pass.wav',
    testFail: 'assets/nature/fail.wav',
    denied: 'assets/nature/deny.wav',
    turnDone: 'assets/nature/done.wav',
  },
}
