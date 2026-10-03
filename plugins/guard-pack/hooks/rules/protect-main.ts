import type { GuardRule } from '../engine'
import { openRepo } from '../git'

// Feature work happens on a branch or a worktree. Asks before a commit, push
// or merge while the repo is on main or master.
const WRITES_HISTORY = /git +(commit|push|merge)/
const PROTECTED = new Set(['main', 'master'])

export const rule: GuardRule = {
  id: 'protect-main',
  decision: 'ask',
  check: async (e, tools) => {
    if (e.tool !== 'Bash' || !WRITES_HISTORY.test(e.command)) return undefined
    const repo = await openRepo(e.command, tools)
    const branch = (await repo?.git('branch', '--show-current'))?.trim()
    return branch !== undefined && PROTECTED.has(branch)
      ? `you are on ${branch}. Feature work happens on a branch or a worktree.`
      : undefined
  },
}
