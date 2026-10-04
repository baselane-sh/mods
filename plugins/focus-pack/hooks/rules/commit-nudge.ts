import type { Nudge } from '../engine'
import { fileEdit } from '../edits'

// Suggests a commit at turn end once this many file edits piled up since the
// last git commit. A commit that ran and succeeded resets the count.
export const THRESHOLD = 8

// `git commit` in command position, so `echo git commit` and `git log` never count.
export const GIT_COMMIT = /(^|[;&|] *)git +(-C +\S+ +)?commit( |$)/m

export const create = (): Nudge => {
  let edits = 0
  let nextAt = THRESHOLD

  return {
    id: 'commit-nudge',
    observe: (e, ran) => {
      if (fileEdit(e, ran) !== undefined) edits += 1
      if (e.tool === 'Bash' && ran.deny === undefined && !ran.isError && GIT_COMMIT.test(e.command)) {
        edits = 0
        nextAt = THRESHOLD
      }
    },
    atStop: () => {
      if (edits < nextAt) return undefined
      nextAt = edits + THRESHOLD // quiet until another batch piles up
      return `${edits} file edits since the last commit. Consider committing.`
    },
  }
}
