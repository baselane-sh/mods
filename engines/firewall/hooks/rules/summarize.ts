import type { SummaryRule } from '../engine'

// The argument that says what a call does, per built-in tool. Names are
// compared as strings: a build may not register every tool listed here.
const FIELD: Readonly<Record<string, string>> = {
  Bash: 'command',
  PowerShell: 'command',
  Read: 'file_path',
  Write: 'file_path',
  Edit: 'file_path',
  MultiEdit: 'file_path',
  NotebookEdit: 'notebook_path',
  WebFetch: 'url',
  Grep: 'pattern',
  Glob: 'pattern',
  Agent: 'description',
  Task: 'description',
}

export const rule: SummaryRule = {
  id: 'summarize',
  summarize: e => {
    const field = FIELD[String(e.tool)]
    if (field === undefined) return undefined
    const value = (e as unknown as Readonly<Record<string, unknown>>)[field]
    return typeof value === 'string' ? value : undefined
  },
}
