import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { Fetched, GitState, Reading } from '../../types'
import { turnComplete } from '../engine'
import { runFetchers, storeFetched } from '../fetch'
import type { BandRule } from '../rule'

// The same atoms as engine.tsx: the state scan wants each spelled in the file
// that reads or writes it. The build writes the mod's own name for the token.
const reading = atom({ plugin: 'todo-count', key: 'reading' } as const, null)
const turnStartUsd = atom({ plugin: 'todo-count', key: 'turnStartUsd' } as const, null)
const turnStartedAt = atom({ plugin: 'todo-count', key: 'turnStartedAt' } as const, null as number | null)
const minute = atom({ plugin: 'todo-count', key: 'minute' } as const, 0)
const git = atom({ plugin: 'todo-count', key: 'git' } as const, null as GitState | null)
const fetched = atom({ plugin: 'todo-count', key: 'fetched' } as const, {} as Readonly<Record<string, Fetched | null>>)

// The turn's end, for a mod whose rules read a figure from a program (a
// fetcher): it runs them again then, and on each minute tick.
export const endTurnsWithFetchers = (on: On, rules: readonly BandRule[]): void => {
  on('turn.complete', async ($, e, next) => {
    // The callbacks close over `$`; they never pass it on.
    await turnComplete(rules, e, {
      usage: () => $.session.usage(),
      reading: () => read($, reading),
      turnStartUsd: () => read($, turnStartUsd),
      keep: (now: Reading) => update($, reading, () => now),
      spend: () => update($, turnStartUsd, () => null),
      endTimer: () => update($, turnStartedAt, () => null),
      model: () => $.session.model(),
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
