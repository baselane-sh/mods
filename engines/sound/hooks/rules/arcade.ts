import type { SoundRule } from '../engine'

export const rule: SoundRule = {
  id: 'arcade',
  clips: {
    testPass: 'assets/arcade/pass.wav',
    testFail: 'assets/arcade/fail.wav',
    denied: 'assets/arcade/deny.wav',
    turnDone: 'assets/arcade/done.wav',
  },
}
