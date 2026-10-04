import type { GuardRule } from '../engine'
import { GIT_VALUE_FLAGS } from '../git'
import { base, commandsOf, hasShortFlag, subcommandOf } from '../shell'

// git commands that throw away uncommitted work or rewrite history. The
// safe shapes pass: reset --soft, clean -n, branch -d, and a rebase that is
// already running (--abort, --continue).
const REBASE_IN_PROGRESS = new Set(['--abort', '--continue', '--skip', '--quit', '--edit-todo', '--show-current-patch'])
const REWRITES = new Set(['filter-branch', 'filter-repo'])

const has = (args: readonly string[], long: string, letter: string): boolean =>
  args.some(arg => arg === long || hasShortFlag(arg, letter))

const isRemoteDelete = (args: readonly string[]): boolean =>
  has(args, '--delete', 'd') || args.some(arg => arg.startsWith(':') && arg.length > 1)

const isForcedBranchDelete = (args: readonly string[]): boolean =>
  args.some(arg => hasShortFlag(arg, 'D')) || (has(args, '--delete', 'd') && has(args, '--force', 'f'))

const dangerOf = (sub: string | undefined, args: readonly string[]): string | undefined => {
  if (sub === 'reset' && args.includes('--hard')) return 'git reset --hard'
  if (sub === 'clean' && !has(args, '--dry-run', 'n')) return 'git clean'
  if (sub === 'rebase' && !args.some(arg => REBASE_IN_PROGRESS.has(arg))) return 'git rebase'
  if (sub !== undefined && REWRITES.has(sub)) return `git ${sub}`
  if (sub === 'push' && isRemoteDelete(args)) return 'git push --delete'
  if (sub === 'branch' && isForcedBranchDelete(args)) return 'git branch -D'
  return sub === 'stash' && args[0] === 'clear' ? 'git stash clear' : undefined
}

export const historyDangersIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => {
    if (argv[0] === undefined || base(argv[0]) !== 'git') return []
    const { sub, args } = subcommandOf(argv, GIT_VALUE_FLAGS)
    const danger = dangerOf(sub, args)
    return danger === undefined ? [] : [danger]
  })
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'git-history-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = historyDangersIn(e.command)
    return found.length === 0 ? undefined : `this throws away work or rewrites git history (${found.join(', ')}). It may not be recoverable.`
  },
}
