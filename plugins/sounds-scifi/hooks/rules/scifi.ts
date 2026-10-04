import type { SoundRule } from '../engine'

export const rule: SoundRule = {
  id: 'scifi',
  clips: {
    testPass: 'assets/scifi/pass.wav',
    testFail: 'assets/scifi/fail.wav',
    denied: 'assets/scifi/deny.wav',
    turnDone: 'assets/scifi/done.wav',
  },
}
