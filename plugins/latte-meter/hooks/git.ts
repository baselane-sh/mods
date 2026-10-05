import type { ProcessRunResult } from 'claude-code'

import type { GitState } from '../types'

// The tools that can change the branch or the files. A Bash call can do both.
export const TOUCHING_TOOLS = new Set(['Bash', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
export const READ_TIMEOUT_MS = 5000

// `git status --porcelain -b`: a `## branch...upstream` line, then one line
// per changed file.
export const parseStatus = (stdout: string): GitState | null => {
  const [head, ...files] = stdout.split('\n')
  if (head === undefined || !head.startsWith('## ')) return null
  const name = head.slice(3).replace(/^No commits yet on /, '').split('...')[0]?.split(' [')[0] ?? ''
  const branch = name === '' ? null : name.startsWith('HEAD (') ? 'detached' : name
  return branch === null ? null : { branch, changed: files.filter(line => line.trim() !== '').length, ...aheadBehind(head) }
}

const count = (counts: string, word: 'ahead' | 'behind'): number =>
  Number(new RegExp(`${word} (\\d+)`).exec(counts)?.[1] ?? 0)

// `## main...origin/main [ahead 2, behind 1]`. A branch with an upstream and
// no brackets is level with it; no `...` is no upstream, and `[gone]` an
// upstream that no longer exists: neither has counts.
const aheadBehind = (head: string): { ahead?: number; behind?: number } => {
  const upstream = /\.\.\.\S+(?: \[(.*)\])?$/.exec(head)
  if (upstream === null) return {}
  const counts = upstream[1] ?? ''
  return counts === 'gone' ? {} : { ahead: count(counts, 'ahead'), behind: count(counts, 'behind') }
}

export const ARGV = ['git', '--no-optional-locks', 'status', '--porcelain', '-b'] as const

// What a refresh needs, as closures: `$` itself is never passed on.
export type GitDeps = {
  run: () => Promise<ProcessRunResult>
  set: (state: GitState | null) => unknown
  log: (text: string) => unknown
}

export const refreshGit = async ({ run, set, log }: GitDeps): Promise<void> => {
  try {
    const ran = await run()
    await set(ran.exitCode === 0 ? parseStatus(ran.stdout) : null)
  } catch (error) {
    await log(`band: git skipped, ${error instanceof Error ? error.message : String(error)}`)
  }
}
