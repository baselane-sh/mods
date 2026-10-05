import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { Fetched, GitState, Outcome, Tally } from '../../types'
import { failed } from '../engine'
import { runFetchers, storeFetched } from '../fetch'
import { ARGV, READ_TIMEOUT_MS, TOUCHING_TOOLS, refreshGit } from '../git'
import type { BandRule } from '../rule'
import { addCall } from '../tally'

const WINDOW = 20

// The same atoms as engine.tsx: the state scan wants each spelled in the
// file that reads or writes it. The build writes the mod's own name for the token.
const outcomes = atom({ plugin: 'dev-band', key: 'outcomes' } as const, [] as readonly Outcome[])
const tally = atom({ plugin: 'dev-band', key: 'tally' } as const, { calls: {}, failures: 0 } as Tally)
const git = atom({ plugin: 'dev-band', key: 'git' } as const, null as GitState | null)
const fetched = atom({ plugin: 'dev-band', key: 'fetched' } as const, {} as Readonly<Record<string, Fetched | null>>)

// Counts the git reads started, so only the newest one writes: a slow read
// that started first never lands over a newer one. Not drawn state.
let gitReads = 0

// Watches each tool call for the rules that draw from how it ended (the recent
// outcomes, the tally of the session) and for the rules that run a program:
// the repository's git status, and the fetchers that read again after an
// edit. The result is passed on as it came: a denied call stays denied. Only
// one hook may answer `tool.call` without a matcher, so they share it.
export const watchCallsWithRun = (on: On, rules: readonly BandRule[]): void => {
  const has = (flag: 'tracksOutcomes' | 'tracksTools' | 'tracksGit'): boolean => rules.some(rule => rule[flag] === true)
  const [isOutcomes, isTally, isGit] = [has('tracksOutcomes'), has('tracksTools'), has('tracksGit')]
  const isFetch = rules.some(rule => rule.fetch?.onEdit === true)

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      const outcome: Outcome = ran.deny !== undefined ? 'block' : ran.isError === true ? 'error' : 'ok'
      if (isOutcomes) await update($, outcomes, recent => [...recent, outcome].slice(-WINDOW))
      if (isTally) await update($, tally, current => addCall(current, e.tool, outcome !== 'ok'))
    } catch (error) {
      await $.ui.log(failed('outcomes', error))
    }
    // A denied call changed nothing. Not awaited: the tool's result does not
    // wait on git, and refreshGit logs its own failures.
    if (isGit && ran.deny === undefined && TOUCHING_TOOLS.has(e.tool)) {
      gitReads += 1
      const id = gitReads
      void refreshGit({
        run: () => $.process.run(ARGV, { timeoutMs: READ_TIMEOUT_MS }),
        set: state => (id === gitReads ? update($, git, () => state) : undefined),
        log: text => $.ui.log(text),
      })
    }
    // A rule that reads a command's output asks again after the same calls,
    // also not awaited.
    if (isFetch && ran.deny === undefined && TOUCHING_TOOLS.has(e.tool)) {
      void runFetchers(rules, 'edit', {
        now: () => $.clock.now(),
        run: (argv, timeoutMs) => $.process.run(argv, { timeoutMs }),
        git: () => read($, git),
        set: (id, value) => storeFetched(change => update($, fetched, change), id, value),
        log: text => $.ui.log(text),
      })
    }
    return ran
  })
}
