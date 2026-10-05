import { beadPrefix, inProgressCount, namesBead } from '../beads'
import { GIT_COMMIT, ranOk } from '../edits'
import type { Nudge } from '../engine'

export const reminder = (count: number): string =>
  `${count === 1 ? 'A commit' : `${count} commits`} this turn named no bead id. Name the bead id in the commit message.`

// At turn end, when this turn ran a successful `git commit` whose message
// names no bead and a bead is in progress. Each commit is judged once. Reads
// with `bd count` and `bd where`; without bd or a beads project it says nothing.
export const create = (): Nudge => {
  let commits: readonly string[] = []
  let cwdOfCommit = ''

  return {
    id: 'bead-commit-nudge',
    observe: (e, ran, cwd) => {
      if (e.tool !== 'Bash' || !ranOk(ran) || !GIT_COMMIT.test(e.command)) return
      commits = [...commits, e.command]
      cwdOfCommit = cwd
    },
    atStop: async tools => {
      const pending = commits
      const dir = cwdOfCommit
      commits = [] // each commit is judged once
      if (pending.length === 0) return undefined
      const count = await inProgressCount(tools, dir)
      if (count === undefined || count === 0) return undefined
      const prefix = await beadPrefix(tools, dir)
      if (prefix === undefined) return undefined
      const unnamed = pending.filter(command => !namesBead(command, prefix)).length
      return unnamed === 0 ? undefined : reminder(unnamed)
    },
  }
}
