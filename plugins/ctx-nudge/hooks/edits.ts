import type { ToolCallEnvelope, ToolCallResult } from 'claude-code'

// What one successful Write or Edit changed, for the rules that read edits.
// A Write has no "before", so every line it writes counts as added.
export type FileEdit = { path: string; before: string; after: string }

export const fileEdit = (e: ToolCallEnvelope, ran: ToolCallResult): FileEdit | undefined => {
  if (ran.deny !== undefined || ran.isError) return undefined
  if (e.tool === 'Write') return { path: e.file_path, before: '', after: e.content }
  if (e.tool === 'Edit') return { path: e.file_path, before: e.old_string, after: e.new_string }
  return undefined
}

const countLines = (text: string, pattern: RegExp): number => text.split('\n').filter(line => pattern.test(line)).length

// Lines matching `pattern` that the edit added: an Edit that only moves an
// existing match adds none.
export const addedLines = (edit: FileEdit, pattern: RegExp): number =>
  Math.max(0, countLines(edit.after, pattern) - countLines(edit.before, pattern))

export const extension = (path: string): string => {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

const CODE = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rs', 'go', 'java', 'kt', 'swift', 'rb', 'php', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'vue', 'svelte'])

export const isCode = (path: string): boolean => CODE.has(extension(path))

export const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`
