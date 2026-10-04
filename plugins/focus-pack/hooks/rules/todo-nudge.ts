import type { Nudge } from '../engine'
import { addedLines, fileEdit, plural } from '../edits'

// Counts lines with TODO, FIXME or HACK that this turn's edits added.
export const MARKER = /\b(TODO|FIXME|HACK)\b/

export const create = (): Nudge => {
  let added = 0

  return {
    id: 'todo-nudge',
    observe: (e, ran) => {
      const edit = fileEdit(e, ran)
      if (edit !== undefined) added += addedLines(edit, MARKER)
    },
    atStop: () => {
      const count = added
      added = 0 // one toast per turn, and only for this turn's lines
      return count === 0 ? undefined : `${plural(count, 'TODO/FIXME/HACK line')} added this turn. Resolve or track them.`
    },
  }
}
