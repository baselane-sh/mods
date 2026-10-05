import type { ToolCallEnvelope, ToolCallResult } from 'claude-code'

import type { FileTouch } from '../types'

// The files ledger: each file a Read, Edit or Write touched this session, with
// a count per action. Pure: the engine reads and writes it in `$.state`.

// The most recently touched files kept; the oldest drop off.
export const MAX_FILES = 300

export type FileAction = 'reads' | 'edits' | 'writes'

const ACTIONS: Readonly<Record<string, FileAction>> = {
  Read: 'reads',
  Edit: 'edits',
  MultiEdit: 'edits',
  NotebookEdit: 'edits',
  Write: 'writes',
}

const pathOf = (e: ToolCallEnvelope): string | undefined => {
  const args = e as unknown as Readonly<Record<string, unknown>>
  const path = args['file_path'] ?? args['notebook_path']
  return typeof path === 'string' && path.length > 0 ? path : undefined
}

// The action a finished call took on a file, or undefined: a denied or failed
// call touched nothing.
export const touchOf = (e: ToolCallEnvelope, ran: ToolCallResult): { path: string; action: FileAction } | undefined => {
  const action = ACTIONS[String(e.tool)]
  const path = pathOf(e)
  if (action === undefined || path === undefined || ran.deny !== undefined || ran.isError === true) return undefined
  return { path, action }
}

// The ledger after one more touch: the file moves to the newest end.
export const touchFile = (ledger: readonly FileTouch[], path: string, action: FileAction, at: number): FileTouch[] => {
  const known = ledger.find(file => file.path === path) ?? { path, reads: 0, edits: 0, writes: 0, at }
  const touched = { ...known, [action]: known[action] + 1, at }
  return [...ledger.filter(file => file.path !== path), touched].slice(-MAX_FILES)
}
