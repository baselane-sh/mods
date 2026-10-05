import type { Pending, SessionMemo } from '../types'
import { isTestCommand } from './testcmd'

export const EMPTY_PENDING: Pending = { calls: 0, blocked: 0, passed: 0, failed: 0, tools: {}, files: [] }
export const FRESH_SESSION: SessionMemo = { counted: false, lastTurn: null, turnStartUsd: null, lastUsd: null, seen: [], calls: 0 }

const MAX_PENDING_FILES = 500
export const MAX_SEEN_FILES = 2000
const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

type Call = { readonly tool: string; readonly [argument: string]: unknown }
type Answer = { readonly deny?: string; readonly isError?: boolean }

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

// The pending counts after one more tool call. Pure. A denied call is a call
// and a block, but touched no file and ran no test.
export const observe = (pending: Pending, e: Call, ran: Answer): Pending => {
  const isDenied = ran.deny !== undefined
  const file = isDenied || !FILE_TOOLS.has(e.tool) ? undefined : (text(e.file_path) ?? text(e.notebook_path))
  const command = isDenied || e.tool !== 'Bash' ? undefined : text(e.command)
  const isTest = command !== undefined && isTestCommand(command)
  const isNewFile = file !== undefined && !pending.files.includes(file) && pending.files.length < MAX_PENDING_FILES

  return {
    calls: pending.calls + 1,
    blocked: pending.blocked + (isDenied ? 1 : 0),
    passed: pending.passed + (isTest && ran.isError !== true ? 1 : 0),
    failed: pending.failed + (isTest && ran.isError === true ? 1 : 0),
    tools: { ...pending.tools, [e.tool]: (pending.tools[e.tool] ?? 0) + 1 },
    files: isNewFile ? [...pending.files, file] : pending.files,
  }
}
