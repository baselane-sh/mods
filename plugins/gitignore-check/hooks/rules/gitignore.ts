import type { GuardRule } from '../engine'
import { lines, openRepo } from '../git'
import { isSecretName } from '../patterns'

// Before `git add` or `git commit`, looks for secret-looking files that git
// would pick up: untracked files no .gitignore rule covers, and files that
// are already tracked.
const ADD_OR_COMMIT = /(^|[;&|] *)git +([^;&|]* +)?(add|commit)( |$)/m
const SHOWN = 5

const secretNamed = (paths: string | undefined): string[] => lines(paths).filter(isSecretName).slice(0, SHOWN)

export const rule: GuardRule = {
  id: 'gitignore-check',
  decision: 'ask',
  check: async (e, tools) => {
    if (e.tool !== 'Bash' || !ADD_OR_COMMIT.test(e.command)) return undefined
    const repo = await openRepo(e.command, tools)
    if (repo === undefined) return undefined
    const unignored = secretNamed(await repo.git('ls-files', '--others', '--exclude-standard'))
    const tracked = secretNamed(await repo.git('ls-files'))
    if (unignored.length === 0 && tracked.length === 0) return undefined
    const parts = [
      ...(unignored.length > 0 ? [`secret-looking file(s) are not ignored and a broad add would stage them: ${unignored.join(' ')}.`] : []),
      ...(tracked.length > 0 ? [`secret-looking file(s) are already tracked by git: ${tracked.join(' ')}.`] : []),
    ]
    return `${parts.join(' ')} Add them to .gitignore, and git rm --cached the tracked ones.`
  },
}
