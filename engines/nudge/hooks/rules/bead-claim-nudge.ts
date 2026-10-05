import { inProgressCount } from '../beads'
import type { Nudge } from '../engine'
import { fileEdit } from '../edits'

export const REMINDER = 'No bead is in progress. Claim one with bd update <id> --claim, or create one, before you go on.'

// At turn end, when this turn edited a file and no bead is in progress here,
// one reminder per session. Reads with `bd count`; without bd or a beads
// project it says nothing.
export const create = (): Nudge => {
  let edited = false
  let reminded = false
  let cwdOfEdit = ''

  return {
    id: 'bead-claim-nudge',
    observe: (e, ran, cwd) => {
      if (fileEdit(e, ran) === undefined) return
      edited = true
      cwdOfEdit = cwd
    },
    atStop: async tools => {
      const dir = cwdOfEdit
      const touched = edited
      edited = false // a turn at a time
      if (!touched || reminded) return undefined
      if ((await inProgressCount(tools, dir)) !== 0) return undefined
      reminded = true
      return REMINDER
    },
  }
}
