import type { Nudge } from '../engine'
import { addedLines, extension, fileEdit, repoPath } from '../edits'

const JS = /^\s*export\s/
const SIGNATURES: Readonly<Record<string, RegExp>> = {
  ts: JS, tsx: JS, js: JS, jsx: JS, mjs: JS, cjs: JS,
  py: /^\s*(async +)?def +[A-Za-z]\w*\(/, // a leading underscore is private
  go: /^func +(\([^)]*\) +)?[A-Z]\w*\(/,
  java: /\bpublic\b.*\(/, kt: /^\s*(fun|public fun) +[A-Za-z]\w*\(/, cs: /\bpublic\b.*\(/,
}

const TEST_FILE = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\./

export const isDocsFile = (path: string): boolean => /(^|\/)readme[^/]*$/i.test(path) || /(^|\/)docs?\//i.test(path)

// One turn-end toast when this turn's edits added exported code or a public
// function signature and no README or docs file was edited in the session.
export const create = (): Nudge => {
  let docsEdited = false
  let apiTouched = false

  return {
    id: 'docs-nudge',
    observe: (e, ran, cwd) => {
      const edit = fileEdit(e, ran)
      if (edit === undefined) return
      const path = repoPath(edit.path, cwd)
      if (isDocsFile(path)) docsEdited = true
      const signature = SIGNATURES[extension(path)]
      if (signature !== undefined && !TEST_FILE.test(path) && addedLines(edit, signature) > 0) apiTouched = true
    },
    atStop: () => {
      const touched = apiTouched
      apiTouched = false
      return touched && !docsEdited ? 'Exported code changed but no README or docs file was edited this session. Check the docs.' : undefined
    },
  }
}
