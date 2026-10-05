import type { SoundRule } from '../engine'

export const rule: SoundRule = {
  id: 'zen',
  clips: {
    testPass: 'assets/zen/pass.wav',
    testFail: 'assets/zen/fail.wav',
    denied: 'assets/zen/deny.wav',
    turnDone: 'assets/zen/done.wav',
  },
}
