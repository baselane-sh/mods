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

const tally = (text: string): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>()
  if (text === '') return counts // no text is no lines, not one empty line
  for (const line of text.split('\n')) counts.set(line, (counts.get(line) ?? 0) + 1)
  return counts
}

const surplus = (from: ReadonlyMap<string, number>, other: ReadonlyMap<string, number>): string[] =>
  [...from].flatMap(([line, n]) => Array.from({ length: Math.max(0, n - (other.get(line) ?? 0)) }, () => line))

// The lines an edit really changed: lines only in `after` were added, lines
// only in `before` were removed. Unchanged context inside an Edit cancels out.
export const changedLines = (edit: FileEdit): { added: string[]; removed: string[] } => {
  const before = tally(edit.before)
  const after = tally(edit.after)
  return { added: surplus(after, before), removed: surplus(before, after) }
}

export const dirname = (path: string): string => path.split('/').slice(0, -1).join('/')

export const basename = (path: string): string => path.split('/').pop() ?? ''

// A command regex for `body` in command position, so `echo tsc` or
// `cat package.json` never match. Package-runner prefixes are allowed.
export const inCommand = (body: string): RegExp =>
  new RegExp(`(^|[;&|] *)((npx|bunx|pnpm exec|pnpm dlx|yarn|uv run|poetry run) +)?(${body})( |$)`, 'm')

// A Bash call that ran: not denied by a hook and not an error result.
export const ranOk = (ran: ToolCallResult): boolean => ran.deny === undefined && !ran.isError

// `git commit` in command position, so `echo git commit` and `git log` never count.
export const GIT_COMMIT = /(^|[;&|] *)git +(-C +\S+ +)?commit( |$)/m
