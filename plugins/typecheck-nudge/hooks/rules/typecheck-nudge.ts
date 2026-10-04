import type { Nudge } from '../engine'
import { extension, fileEdit, inCommand, plural } from '../edits'

// A type check or a build, in command position. A build counts because it
// type-checks in most TypeScript projects.
const SCRIPT = '(npm|pnpm|yarn|bun) +(run +)?(typecheck|type-check|check-types|tsc|build)'
export const TYPE_CHECK = inCommand(`${SCRIPT}|(vue-)?tsc|next +build|turbo +(run +)?(build|typecheck)|make +build`)

const isTypeScript = (path: string): boolean => ['ts', 'tsx'].includes(extension(path))

// Counts tool calls so "checked since the last edit" is an order, not a clock.
// A check that found errors still counts: it ran. A denied one did not.
export const create = (): Nudge => {
  let step = 0
  let editedAt = 0
  let checkedAt = 0
  let files: readonly string[] = []

  return {
    id: 'typecheck-nudge',
    observe: (e, ran) => {
      step += 1
      const edit = fileEdit(e, ran)
      if (edit !== undefined && isTypeScript(edit.path)) {
        editedAt = step
        files = files.includes(edit.path) ? files : [...files, edit.path]
      }
      if (e.tool === 'Bash' && ran.deny === undefined && TYPE_CHECK.test(e.command)) {
        checkedAt = step
        files = [] // checked files no longer wait on a check
      }
    },
    atStop: () => {
      if (editedAt === 0 || checkedAt > editedAt) return undefined
      const count = files.length
      editedAt = 0 // one toast per batch of edits
      files = []
      return `${plural(count, 'TypeScript file')} edited and no type check ran since. Run tsc or your typecheck script.`
    },
  }
}
