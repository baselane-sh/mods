import type { Composed, CommandTools } from './engine'
import { redact } from './patterns'

export const lines = (text: string | undefined): string[] =>
  (text ?? '').split('\n').filter(line => line.length > 0)

// True inside a git work tree.
export const isRepo = async (tools: CommandTools): Promise<boolean> =>
  (await tools.git('rev-parse', '--is-inside-work-tree')) !== undefined

// An answer that is a message, not a result: printed, never copied.
export const message = (text: string): Composed => ({ text, copy: false })

export const notARepo = (dir: string): Composed =>
  message(`Not a git repository: ${dir}\nRun this command from a folder inside a git repo.`)

// Everything a command prints or writes passes here last: commit subjects and
// paths are free text and can carry a credential.
export const finish = (text: string): string => redact(text)

// "1 tool call", "2 tool calls".
export const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`

// Bullets for the first `limit` items, then one line for the rest.
export const bullets = (items: readonly string[], limit: number, indent = ''): string[] => [
  ...items.slice(0, limit).map(item => `${indent}- ${item}`),
  ...(items.length > limit ? [`${indent}- and ${items.length - limit} more`] : []),
]

// Items grouped by key, in first-seen order (Map.groupBy is past the es2023 lib).
export const groupBy = <T>(items: readonly T[], key: (item: T) => string): [string, T[]][] => {
  // Built in place: copying per item would be quadratic on a long git log.
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const mine = groups.get(key(item))
    if (mine === undefined) groups.set(key(item), [item])
    else mine.push(item)
  }
  return [...groups]
}

// The repo's top folder (not the cwd), or undefined outside a repo.
export const repoRoot = async (tools: CommandTools): Promise<string | undefined> =>
  (await tools.git('rev-parse', '--show-toplevel'))?.trim() || undefined

// The first `limit` rows, then "+N more" for the rest (the todos wording).
export const cap = (rows: readonly string[], limit: number): string[] => [
  ...rows.slice(0, limit),
  ...(rows.length > limit ? [`+${rows.length - limit} more`] : []),
]
