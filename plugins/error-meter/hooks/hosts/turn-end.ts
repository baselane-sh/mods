import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { Reading } from '../../types'
import { NO_MODEL, NO_STORE, turnComplete } from '../engine'
import type { BandRule } from '../rule'

// The same atoms as engine.tsx: the state scan wants each spelled in the file
// that reads or writes it. The build writes the mod's own name for the token.
const reading = atom({ plugin: 'error-meter', key: 'reading' } as const, null)
const turnStartUsd = atom({ plugin: 'error-meter', key: 'turnStartUsd' } as const, null)
const turnStartedAt = atom({ plugin: 'error-meter', key: 'turnStartedAt' } as const, null as number | null)
const minute = atom({ plugin: 'error-meter', key: 'minute' } as const, 0)

// The turn's end: each rule's figures, kept for the band to draw. It gives
// no model read and no store (see turn-end-model.ts, turn-end-store.ts).
export const endTurns = (on: On, rules: readonly BandRule[]): void => {
  on('turn.complete', async ($, e, next) => {
    // The callbacks close over `$`; they never pass it on.
    await turnComplete(rules, e, {
      usage: () => $.session.usage(),
      reading: () => read($, reading),
      turnStartUsd: () => read($, turnStartUsd),
      keep: (now: Reading) => update($, reading, () => now),
      spend: () => update($, turnStartUsd, () => null),
      endTimer: () => update($, turnStartedAt, () => null),
      model: NO_MODEL,
      store: NO_STORE,
      clock: {
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
        every: (ms, fn) => $.clock.every(ms, fn),
      },
      redraw: () => update($, minute, n => n + 1),
      log: text => $.ui.log(text),
    })
    return next(e)
  })
}
