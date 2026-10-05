import type { Fetched } from '../../types'
import type { BandRule } from '../rule'

const FAILED = new Set(['failure', 'timed_out', 'startup_failure', 'action_required'])

// The latest run as `gh run list --json status,conclusion` answers it: a JSON
// array with at most one run. No run, or anything unexpected, shows nothing.
export const parseRun = (stdout: string, branch: string): Fetched | null => {
  let runs: unknown
  try {
    runs = JSON.parse(stdout)
  } catch {
    return null
  }
  const run = Array.isArray(runs) ? runs[0] : undefined
  if (typeof run !== 'object' || run === null) return null
  const { status, conclusion } = run as { status?: unknown; conclusion?: unknown }
  if (typeof status !== 'string') return null
  if (status !== 'completed') return { text: 'ci running', color: 'yellow', tag: branch }
  if (conclusion === 'success') return { text: 'ci passed', color: 'green', tag: branch }
  if (typeof conclusion !== 'string' || conclusion === '') return null
  return FAILED.has(conclusion)
    ? { text: 'ci failed', color: 'red', tag: branch }
    : { text: `ci ${conclusion.replaceAll('_', ' ')}`, tag: branch }
}

// The latest GitHub Actions run of the current branch, asked of `gh` at most
// every two minutes. The branch comes from the engine's git read, so nothing
// shows before the first Bash call or edit. No gh, no login, no run, a
// detached head or a failed call: hidden. A figure for another branch is
// never drawn.
export const rule: BandRule = {
  id: 'ci-band',
  tracksGit: true,
  fetch: {
    everyMs: 120_000,
    timeoutMs: 10_000,
    read: async (run, git) => {
      if (git === null) return undefined
      // A branch name never starts with a dash, so none is read as an option.
      if (git.branch === 'detached' || git.branch.startsWith('-')) return null
      const ran = await run(['gh', 'run', 'list', '--branch', git.branch, '--limit', '1', '--json', 'status,conclusion'])
      return ran.exitCode === 0 ? parseRun(ran.stdout, git.branch) : null
    },
  },
  segment: ({ fetched, git }) => {
    const found = fetched['ci-band']
    if (found === null || found === undefined || found.tag !== git?.branch) return undefined
    return { key: 'ci-band', text: found.text, ...(found.color === undefined ? {} : { color: found.color }) }
  },
}
