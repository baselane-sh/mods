import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, isRepo, lines, message, notARepo } from '../helpers'

const MAX_SUBJECT = 71
const MAX_BODY_FILES = 20

type Change = { status: string; path: string; from?: string }
type Kind = 'source' | 'docs' | 'test' | 'ci' | 'build' | 'chore'

const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|Cargo\.lock|poetry\.lock|uv\.lock|go\.sum|Gemfile\.lock|composer\.lock)$/
const MANIFEST = /(^|\/)(package\.json|tsconfig[^/]*\.json|pyproject\.toml|Cargo\.toml|go\.mod|Gemfile|composer\.json|Dockerfile|Makefile|requirements[^/]*\.txt)$/
// Folders that only repeat the type, so they make a poor scope.
const TYPE_FOLDERS = new Set(['docs', 'test', 'tests', '__tests__', '.github', '.circleci'])

// "M\tsrc/a.ts" and "R100\told\tnew" become changes. A row with no path is dropped.
const parse = (row: string): Change | undefined => {
  const [status, first, second] = row.split('\t')
  if (status === undefined || first === undefined || first === '') return undefined
  return second === undefined || second === '' ? { status: status.charAt(0), path: first } : { status: status.charAt(0), path: second, from: first }
}

const kindOf = (path: string): Kind => {
  if (/(^|\/)(\.github|\.circleci)\//.test(path) || /(^|\/)(\.gitlab-ci\.yml|Jenkinsfile)$/.test(path)) return 'ci'
  if (/\.(md|mdx|rst|txt)$/i.test(path) || /^docs\//.test(path) || /(^|\/)LICENSE/.test(path)) return 'docs'
  if (/(^|\/)(tests?|__tests__|spec)\//.test(path) || /\.(test|spec)\.[^/]+$/.test(path)) return 'test'
  if (LOCKFILE.test(path) || MANIFEST.test(path)) return 'build'
  if (/(^|\/)\.[^/]+$/.test(path)) return 'chore'
  return 'source'
}

// Source decides the type when there is any. Otherwise the first kind present
// in this order: tests, docs, ci, build, chore.
const KIND_ORDER: readonly Kind[] = ['test', 'docs', 'ci', 'build', 'chore']

const deciding = (changes: readonly Change[]): { kind: Kind; changes: Change[] } => {
  const source = changes.filter(c => kindOf(c.path) === 'source')
  if (source.length > 0) return { kind: 'source', changes: source }
  const kind = KIND_ORDER.find(k => changes.some(c => kindOf(c.path) === k)) ?? 'chore'
  return { kind, changes: changes.filter(c => kindOf(c.path) === kind) }
}

const typeOf = (kind: Kind, changes: readonly Change[]): string => {
  if (kind !== 'source') return kind === 'test' ? 'test' : kind
  if (changes.some(c => c.status === 'A')) return 'feat'
  return changes.every(c => c.status === 'D' || c.status === 'R') ? 'refactor' : 'fix'
}

// The folder every deciding file sits in, when they all share one.
const scopeOf = (changes: readonly Change[]): string | undefined => {
  const tops = new Set(changes.map(c => (c.path.includes('/') ? c.path.slice(0, c.path.indexOf('/')) : '')))
  const [only] = [...tops]
  return tops.size === 1 && only !== undefined && only !== '' && !TYPE_FOLDERS.has(only) ? only : undefined
}

const VERBS: Readonly<Record<string, string>> = { A: 'add', D: 'remove', R: 'rename' }

const verbOf = (changes: readonly Change[]): string => {
  const verbs = new Set(changes.map(c => VERBS[c.status] ?? 'update'))
  const [only] = [...verbs]
  return verbs.size === 1 && only !== undefined ? only : 'update'
}

const base = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

const subjectOf = (changes: readonly Change[]): string => {
  const { kind, changes: mine } = deciding(changes)
  const scope = scopeOf(mine)
  const target = mine.length === 1 ? base(mine[0]?.path ?? '') : `${mine.length} files`
  const full = `${typeOf(kind, mine)}${scope === undefined ? '' : `(${scope})`}: ${verbOf(mine)} ${target}`
  return full.length <= MAX_SUBJECT ? full : `${full.slice(0, MAX_SUBJECT - 3)}...`
}

const BODY_WORDS: Readonly<Record<string, string>> = { A: 'added', D: 'deleted', R: 'renamed' }

const bodyRow = (c: Change): string =>
  c.status === 'R' && c.from !== undefined ? `- renamed ${c.from} to ${c.path}` : `- ${BODY_WORDS[c.status] ?? 'modified'} ${c.path}`

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const changes = lines(await tools.git('diff', '--cached', '--name-status', '-M'))
    .map(parse)
    .filter((c): c is Change => c !== undefined)
  if (changes.length === 0) return message('Nothing is staged. Run git add on the files first.')

  const rest = changes.length - MAX_BODY_FILES
  return finish(
    [
      subjectOf(changes),
      '',
      ...changes.slice(0, MAX_BODY_FILES).map(bodyRow),
      ...(rest > 0 ? [`- and ${rest} more`] : []),
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'commit-msg',
  description: 'Propose a Conventional Commits message from the staged diff (heuristic, no model), and copy it',
  compose,
}
