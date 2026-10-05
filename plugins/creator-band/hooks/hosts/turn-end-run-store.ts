import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { Fetched, GitState, Reading } from '../../types'
import { NO_MODEL, turnComplete } from '../engine'
import { runFetchers, storeFetched } from '../fetch'
import type { BandRule } from '../rule'

// The same atoms as engine.tsx: the state scan wants each spelled in the file
// that reads or writes it. The build writes the mod's own name for the token.
const reading = atom({ plugin: 'creator-band', key: 'reading' } as const, null)
const turnStartUsd = atom({ plugin: 'creator-band', key: 'turnStartUsd' } as const, null)
const turnStartedAt = atom({ plugin: 'creator-band', key: 'turnStartedAt' } as const, null as number | null)
const minute = atom({ plugin: 'creator-band', key: 'minute' } as const, 0)
const git = atom({ plugin: 'creator-band', key: 'git' } as const, null as GitState | null)
const fetched = atom({ plugin: 'creator-band', key: 'fetched' } as const, {} as Readonly<Record<string, Fetched | null>>)

// The turn's end, for a mod whose rules read a figure from a program (a
// fetcher) and keep a figure in the mod's own store: it runs the fetchers
// again then, and on each minute tick. It gives no model read.
export const endTurnsWithFetchersAndStore = (on: On, rules: readonly BandRule[]): void => {
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
      store: {
        get: (key: string) => $.store.get(key),
        set: (key: string, value: unknown) => $.store.set(key, value),
      },
      clock: {
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
        every: (ms, fn) => $.clock.every(ms, fn),
      },
      redraw: () => update($, minute, n => n + 1),
      log: text => $.ui.log(text),
      refresh: () =>
        void runFetchers(rules, 'time', {
          now: () => $.clock.now(),
          run: (argv, timeoutMs) => $.process.run(argv, { timeoutMs }),
          git: () => read($, git),
          set: (id, value) => storeFetched(change => update($, fetched, change), id, value),
          log: text => $.ui.log(text),
        }),
    })
    return next(e)
  })
}
