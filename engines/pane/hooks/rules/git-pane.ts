import type { ProcessRunResult, ToolCallEnvelope } from 'claude-code'

import type { PaneCell, PaneLine } from '../../types'
import { clean, line, ruleLine } from '../lines'
import type { PaneRule } from '../rule'

// The branch, its upstream, the changed files and the last commits, read with
// `git status --porcelain=v2 --branch` and `git log`. `--no-optional-locks`
// keeps a refresh from taking index.lock while the agent runs git itself.

const MAX_FILES = 20
const COMMITS = 5

type Branch = { head: string; oid: string; upstream?: string; ahead?: number; behind?: number }

// `xy` is git's pair: the staged letter, then the unstaged one, `.` for none.
// `?` is untracked, `u` a merge conflict.
export type Change = { kind: '1' | '2' | 'u' | '?'; xy: string; path: string }

const WRITES = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
const GIT_COMMAND = /(^|[\s;&|(`])git(\s|$)/

const refreshAfter = (e: ToolCallEnvelope): boolean => {
  if (WRITES.has(String(e.tool))) return true
  return e.tool === 'Bash' && GIT_COMMAND.test(e.command)
}

// Splits off `count` space-separated fields; the rest of the line is the path.
const fields = (text: string, count: number): string[] => {
  const parts = text.split(' ')
  return [...parts.slice(0, count), parts.slice(count).join(' ')]
}

export const parseStatus = (stdout: string): { branch: Branch; changes: Change[] } => {
  let branch: Branch = { head: '', oid: '' }
  const changes: Change[] = []
  for (const text of stdout.split('\n')) {
    if (text.startsWith('# branch.head ')) branch = { ...branch, head: text.slice(14) }
    else if (text.startsWith('# branch.oid ')) branch = { ...branch, oid: text.slice(13) }
    else if (text.startsWith('# branch.upstream ')) branch = { ...branch, upstream: text.slice(18) }
    else if (text.startsWith('# branch.ab ')) {
      const [ahead, behind] = text.slice(12).split(' ')
      branch = { ...branch, ahead: Math.abs(Number(ahead)), behind: Math.abs(Number(behind)) }
    } else if (text.startsWith('1 ')) {
      const parts = fields(text, 8)
      changes.push({ kind: '1', xy: parts[1] ?? '..', path: parts[8] ?? '' })
    } else if (text.startsWith('2 ')) {
      const parts = fields(text, 9)
      const [path = '', from = ''] = (parts[9] ?? '').split('\t')
      changes.push({ kind: '2', xy: parts[1] ?? '..', path: `${from} → ${path}` })
    } else if (text.startsWith('u ')) {
      const parts = fields(text, 10)
      changes.push({ kind: 'u', xy: parts[1] ?? 'UU', path: parts[10] ?? '' })
    } else if (text.startsWith('? ')) {
      changes.push({ kind: '?', xy: '??', path: text.slice(2) })
    }
  }
  return { branch, changes }
}

const branchLine = (branch: Branch): PaneLine => {
  const head: PaneCell =
    branch.head === '(detached)'
      ? { text: `detached at ${branch.oid.slice(0, 7)}`, bold: true, color: 'yellow' }
      : { text: branch.head, bold: true, color: 'cyan' }
  if (branch.upstream === undefined) return line('branch', head, { text: '  no upstream', dim: true })
  const ahead = branch.ahead ?? 0
  const behind = branch.behind ?? 0
  return line(
    'branch',
    head,
    { text: `  tracks ${branch.upstream}`, dim: true },
    { text: `  ahead ${ahead}`, ...(ahead > 0 ? { color: 'yellow' } : {}) },
    { text: `  behind ${behind}`, ...(behind > 0 ? { color: 'yellow' } : {}) },
  )
}

const tally = (changes: readonly Change[]): string => {
  const tracked = changes.filter(change => change.kind === '1' || change.kind === '2')
  const counts = [
    [tracked.filter(change => change.xy[0] !== '.').length, 'staged'],
    [tracked.filter(change => change.xy[1] !== '.').length, 'unstaged'],
    [changes.filter(change => change.kind === 'u').length, 'conflict'],
    [changes.filter(change => change.kind === '?').length, 'untracked'],
  ] as const
  return counts
    .filter(([count]) => count > 0)
    .map(([count, word]) => `${count} ${word === 'conflict' && count > 1 ? 'conflicts' : word}`)
    .join('  ')
}

const letter = (text: string, color: string): PaneCell => (text === '.' ? { text, dim: true } : { text, color })

const changeLine = (change: Change): PaneLine => {
  const path: PaneCell = { text: ` ${clean(change.path)}` }
  if (change.kind === 'u') return line(`file-${change.path}`, { text: change.xy, color: 'magenta', bold: true }, path)
  if (change.kind === '?') return line(`file-${change.path}`, { text: '??', color: 'red' }, path)
  return line(`file-${change.path}`, letter(change.xy[0] ?? '.', 'green'), letter(change.xy[1] ?? '.', 'red'), path)
}

const changeLines = (changes: readonly Change[]): PaneLine[] => {
  if (changes.length === 0) return [line('changes', { text: 'No changes', dim: true })]
  const rest = changes.length - MAX_FILES
  return [
    line('changes', { text: 'Changes', bold: true }, { text: `  ${tally(changes)}` }),
    ...changes.slice(0, MAX_FILES).map(changeLine),
    ...(rest > 0 ? [line('files-more', { text: `… and ${rest} more`, dim: true })] : []),
  ]
}

const commitLines = (log: ProcessRunResult): PaneLine[] => {
  const commits = log.exitCode === 0 ? log.stdout.split('\n').filter(text => text.length > 0) : []
  if (commits.length === 0) return [line('commits', { text: 'No commits yet', dim: true })]
  return [
    line('commits', { text: `Last ${commits.length === 1 ? 'commit' : `${commits.length} commits`}, newest first`, bold: true }),
    ...commits.map(text => {
      const [hash = '', when = '', ...subject] = text.split('\t')
      return line(
        `commit-${hash}`,
        { text: hash, color: 'yellow' },
        { text: `  ${clean(when)}`, dim: true },
        { text: `  ${clean(subject.join(' '))}` },
      )
    }),
  ]
}

const firstLine = (text: string): string => text.split('\n').find(each => each.trim().length > 0)?.trim() ?? ''

export const rule: PaneRule = {
  id: 'git-pane',
  pane: {
    id: 'git',
    title: 'Git',
    command: 'git',
    description: 'Show or hide the Git pane: branch, ahead and behind, changed files, last commits',
    empty: 'Reading the repo…',
  },
  everyMs: 15_000,
  refreshAfter,
  load: async host => {
    const cwd = await host.cwd()
    const git = (...args: string[]) => host.run(['git', '--no-optional-locks', '-C', cwd, ...args])
    let status: ProcessRunResult
    try {
      status = await git('status', '--porcelain=v2', '--branch')
    } catch (error) {
      return [line('failed', { text: `git did not run: ${error instanceof Error ? error.message : String(error)}`, color: 'red' })]
    }
    if (status.exitCode !== 0) {
      const reason = firstLine(status.stderr)
      if (/not a git repository/i.test(reason)) return [line('no-repo', { text: `Not a git repository: ${cwd}`, dim: true })]
      return [line('failed', { text: `git status failed: ${reason}`, color: 'red' })]
    }
    const { branch, changes } = parseStatus(status.stdout)
    const log = await git('log', `-${COMMITS}`, '--format=%h%x09%cr%x09%s')
    return [branchLine(branch), ruleLine('rule-changes'), ...changeLines(changes), ruleLine('rule-commits'), ...commitLines(log)]
  },
}
