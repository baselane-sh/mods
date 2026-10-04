import type { Nudge } from '../engine'
import { addedLines, fileEdit, isCode, plural } from '../edits'

// console.log, print(, a debugger statement or dbg!( on a line. `print(` must
// not follow a word character or a dot, so `blueprint(` and `doc.print(` pass.
export const DEBUG_LINE = /\bconsole\.log\b|(^|[^\w.])print\(|^\s*debugger\b|\bdbg!/

export const create = (): Nudge => {
  let added = 0

  return {
    id: 'debug-print-nudge',
    observe: (e, ran) => {
      const edit = fileEdit(e, ran)
      if (edit !== undefined && isCode(edit.path)) added += addedLines(edit, DEBUG_LINE)
    },
    atStop: () => {
      const count = added
      added = 0
      return count === 0 ? undefined : `${plural(count, 'debug print line')} added this turn. Remove before committing.`
    },
  }
}
