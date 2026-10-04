import type { SoundRule } from '../engine'

export const rule: SoundRule = {
  id: 'office',
  clips: {
    testPass: 'assets/office/pass.wav',
    testFail: 'assets/office/fail.wav',
    denied: 'assets/office/deny.wav',
    turnDone: 'assets/office/done.wav',
  },
}
