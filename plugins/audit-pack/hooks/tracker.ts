import type { ToolCallResult } from 'claude-code'

import type { CommandRecord } from '../types'
import { redact } from './patterns'

export const EMPTY: CommandRecord = { calls: 0, tools: {}, files: [], commands: [], commandsRun: 0, blocked: 0, errored: 0 }

const MAX_COMMANDS = 200
const MAX_COMMAND_LENGTH = 200
const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

type Call = { readonly tool: string; readonly [argument: string]: unknown }
type Answer = Pick<ToolCallResult, 'deny' | 'isError'> | { readonly deny?: undefined; readonly isError?: boolean }

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const touchedFile = (e: Call): string | undefined =>
  FILE_TOOLS.has(e.tool) ? (text(e.file_path) ?? text(e.notebook_path)) : undefined

// Redacts before cutting, so a credential is never kept half-cut.
const keep = (raw: string, limit: number): string => redact(raw).slice(0, limit)

// The record after one more tool call. Pure: the record it is given is not
// changed. A denied call counts as a call and as blocked, but it touched no
// file and ran no command.
export const observe = (record: CommandRecord, e: Call, ran: Answer): CommandRecord => {
  const isDenied = ran.deny !== undefined
  const file = isDenied ? undefined : touchedFile(e)
  const command = isDenied || e.tool !== 'Bash' ? undefined : text(e.command)
  const kept = file === undefined ? undefined : keep(file, 500)

  return {
    calls: record.calls + 1,
    tools: { ...record.tools, [e.tool]: (record.tools[e.tool] ?? 0) + 1 },
    files: kept === undefined || record.files.includes(kept) ? record.files : [...record.files, kept],
    commands: command === undefined ? record.commands : [...record.commands, keep(command, MAX_COMMAND_LENGTH)].slice(-MAX_COMMANDS),
    commandsRun: record.commandsRun + (command === undefined ? 0 : 1),
    blocked: record.blocked + (isDenied ? 1 : 0),
    errored: record.errored + (!isDenied && ran.isError === true ? 1 : 0),
  }
}
