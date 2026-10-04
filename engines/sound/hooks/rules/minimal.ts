import type { SoundRule } from '../engine'

export const rule: SoundRule = {
  id: 'minimal',
  clips: {
    testPass: 'assets/minimal/pass.wav',
    testFail: 'assets/minimal/fail.wav',
    denied: 'assets/minimal/deny.wav',
    turnDone: 'assets/minimal/done.wav',
  },
}
