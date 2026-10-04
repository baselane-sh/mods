import type { GuardRule } from '../engine'
import { lines, openRepo } from '../git'
import type { Repo } from '../git'
import { isSecretName, SECRET_VALUE } from '../patterns'

// Before `git commit`, scans what the commit would record. Catches secrets
// that reached files by any path (an editor, a script, a paste), not only
// through Claude's own Write and Edit calls. Anything may sit between `git`
// and `commit` (-c key=val, -C dir, --git-dir=...).
const COMMIT = /(^|[;&|] *)git +([^;&|]* +)?commit( |$)/m
// -a / --all commits unstaged changes to tracked files as well.
const COMMIT_ALL = /git.* commit.* (-[a-zA-Z]*a[a-zA-Z]*|--all)( |$)/m

export type Findings = { valueLines: number; valueFiles: string[]; nameFiles: string[] }

// Counts added lines that carry a credential shape, per file, from one
// unified diff with no context lines.
export const scanDiff = (diff: string): Pick<Findings, 'valueLines' | 'valueFiles'> => {
  let file = ''
  let valueLines = 0
  const valueFiles = new Set<string>()
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line.replace(/^\+\+\+ (b\/)?/, '')
    } else if (line.startsWith('+') && SECRET_VALUE.test(line.slice(1))) {
      valueLines += 1
      valueFiles.add(file)
    }
  }
  return { valueLines, valueFiles: [...valueFiles] }
}

const scanScope = async (repo: Repo, scope: string): Promise<Findings> => {
  const names = lines(await repo.git('diff', scope, '--name-only', '--diff-filter=AMR'))
  const diff = await repo.git('diff', scope, '-U0', '--diff-filter=AM')
  return { ...scanDiff(diff ?? ''), nameFiles: names.filter(isSecretName) }
}

export const summarize = ({ valueLines, valueFiles, nameFiles }: Findings): string | undefined => {
  if (valueFiles.length === 0 && nameFiles.length === 0) return undefined
  const parts = [
    ...(valueFiles.length > 0 ? [`the commit adds ${valueLines} credential-looking line(s) in: ${valueFiles.join(' ')}.`] : []),
    ...(nameFiles.length > 0 ? [`secret-named file(s) would be committed: ${nameFiles.join(' ')}.`] : []),
  ]
  return `${parts.join(' ')} Unstage them and move the value to an env var or a secret manager.`
}

export const rule: GuardRule = {
  id: 'secret-commit-guard',
  decision: 'ask',
  check: async (e, tools) => {
    if (e.tool !== 'Bash' || !COMMIT.test(e.command)) return undefined
    const repo = await openRepo(e.command, tools)
    if (repo === undefined) return undefined
    const scopes = COMMIT_ALL.test(e.command) ? ['--cached', 'HEAD'] : ['--cached']
    const found = await Promise.all(scopes.map(scope => scanScope(repo, scope)))
    return summarize({
      valueLines: found.reduce((sum, f) => sum + f.valueLines, 0),
      valueFiles: [...new Set(found.flatMap(f => f.valueFiles))],
      nameFiles: [...new Set(found.flatMap(f => f.nameFiles))],
    })
  },
}
