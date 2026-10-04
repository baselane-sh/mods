import type { Nudge } from '../engine'
import { fileEdit, isCode } from '../edits'

// Environment variable references: process.env.X, process.env["X"],
// os.environ["X"], os.environ.get("X"), os.getenv("X"), Deno.env.get("X").
const REFERENCE =
  /process\.env\.([A-Za-z_]\w*)|process\.env\[\s*["'`]([A-Za-z_]\w*)["'`]\s*\]|os\.environ(?:\.get)?\s*[[(]\s*["']([A-Za-z_]\w*)["']|os\.getenv\(\s*["']([A-Za-z_]\w*)["']|Deno\.env\.get\(\s*["']([A-Za-z_]\w*)["']/g

// Set by the runtime, not by the person, so it never belongs in .env.example.
const IGNORED = new Set(['NODE_ENV'])

export const referencedNames = (text: string): string[] =>
  [...text.matchAll(REFERENCE)].flatMap(match => {
    const name = match.slice(1).find(group => group !== undefined)
    return name === undefined || IGNORED.has(name) ? [] : [name]
  })

// One turn-end toast naming variables this turn's edits started to reference
// that `.env.example` does not list. Only `.env.example` is read, and only
// for its names. With no `.env.example` the rule stays quiet.
export const create = (): Nudge => {
  let added: readonly string[] = []

  return {
    id: 'env-example-nudge',
    observe: (e, ran) => {
      const edit = fileEdit(e, ran)
      if (edit === undefined || !isCode(edit.path)) return
      const known = new Set(referencedNames(edit.before))
      const fresh = referencedNames(edit.after).filter(name => !known.has(name) && !added.includes(name))
      added = [...added, ...new Set(fresh)]
    },
    atStop: async tools => {
      const names = added
      added = [] // one toast per turn, and only for this turn's references
      if (names.length === 0) return undefined
      const listed = await tools.envExampleNames()
      if (listed === undefined) return undefined
      const missing = names.filter(name => !listed.includes(name))
      if (missing.length === 0) return undefined
      const many = missing.length > 1
      return `new environment variable${many ? 's' : ''} not in .env.example: ${missing.join(', ')}. Add ${many ? 'them' : 'it'} so others can set up the project.`
    },
  }
}
