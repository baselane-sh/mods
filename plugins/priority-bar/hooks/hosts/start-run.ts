import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { Fetched, GitState } from '../../types'
import { runFetchers, storeFetched } from '../fetch'
import type { BandRule } from '../rule'

// The same atoms as engine.tsx: the state scan wants each spelled in the file
// that reads or writes it. The build writes the mod's own name for the token.
const git = atom({ plugin: 'priority-bar', key: 'git' } as const, null as GitState | null)
const fetched = atom({ plugin: 'priority-bar', key: 'fetched' } as const, {} as Readonly<Record<string, Fetched | null>>)

// The first figures of the fetching rules, which come with the session and
// not the first turn end. Not awaited: the session does not wait on them.
export const startSessionWithFetchers = (on: On, rules: readonly BandRule[]): void => {
  on('session.start', async ($, e, next) => {
    void runFetchers(rules, 'time', {
      now: () => $.clock.now(),
      run: (argv, timeoutMs) => $.process.run(argv, { timeoutMs }),
      git: () => read($, git),
      set: (id, value) => storeFetched(change => update($, fetched, change), id, value),
      log: text => $.ui.log(text),
    })
    return next(e)
  })
}
