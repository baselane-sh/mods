import type { Nudge } from '../engine'
import { GIT_COMMIT, changedLines, fileEdit, ranOk } from '../edits'

// Suggests splitting the change once more than this many lines were added or
// removed since the last git commit. An edit's unchanged context cancels out.
// A Write over an existing file counts only the lines it changed.
export const THRESHOLD = 500

export const create = (): Nudge => {
  let changed = 0
  let nextAt = THRESHOLD

  return {
    id: 'big-diff-nudge',
    observe: (e, ran) => {
      const edit = fileEdit(e, ran)
      if (edit !== undefined) {
        const { added, removed } = changedLines(edit)
        changed += added.length + removed.length
      }
      if (e.tool === 'Bash' && ranOk(ran) && GIT_COMMIT.test(e.command)) {
        changed = 0
        nextAt = THRESHOLD
      }
    },
    atStop: () => {
      if (changed <= nextAt) return undefined
      nextAt = changed + THRESHOLD // quiet until another batch piles up
      return `${changed} lines changed since the last commit. Consider splitting this into smaller commits.`
    },
  }
}
