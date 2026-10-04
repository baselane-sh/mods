import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, groupBy, isRepo, lines, message, notARepo } from '../helpers'

// Generated, not written by hand: counting them would bury the code.
const LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'bun.lockb', 'go.sum', 'composer.lock'])

const LANGUAGES: Readonly<Record<string, string>> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', swift: 'Swift', rb: 'Ruby', php: 'PHP',
  c: 'C', h: 'C', cc: 'C++', cpp: 'C++', hpp: 'C++', cs: 'C#', sh: 'Shell', bash: 'Shell', zsh: 'Shell',
  md: 'Markdown', json: 'JSON', yml: 'YAML', yaml: 'YAML', toml: 'TOML', html: 'HTML', css: 'CSS', scss: 'CSS',
  sql: 'SQL', vue: 'Vue', svelte: 'Svelte',
}

type Row = { file: string; count: number }
type Total = { language: string; files: number; lines: number }

const isLockfile = (file: string): boolean => {
  const name = file.slice(file.lastIndexOf('/') + 1)
  return LOCKFILES.has(name) || name.endsWith('.lock')
}

// "src/a.ts:100" becomes a row. A file with 0 lines never appears in git grep -c.
const parse = (row: string): Row | undefined => {
  const cut = row.lastIndexOf(':')
  const count = Number(row.slice(cut + 1))
  return cut < 1 || !Number.isInteger(count) || count < 1 ? undefined : { file: row.slice(0, cut), count }
}

const languageOf = (file: string): string => {
  const name = file.slice(file.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  if (name === 'Makefile') return 'Makefile'
  if (name === 'Dockerfile') return 'Dockerfile'
  if (dot < 1) return '(no extension)'
  const ext = name.slice(dot + 1).toLowerCase()
  return LANGUAGES[ext] ?? `.${ext}`
}

const totals = (rows: readonly Row[]): Total[] =>
  groupBy(rows, row => languageOf(row.file))
    .map(([language, mine]) => ({ language, files: mine.length, lines: mine.reduce((sum, row) => sum + row.count, 0) }))
    .sort((a, b) => b.lines - a.lines || a.language.localeCompare(b.language))

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  // -I skips binary files; -c '' counts every line of each tracked file.
  const rows = lines(await tools.git('grep', '-I', '-c', '-e', '', '--', '.'))
    .map(parse)
    .filter((row): row is Row => row !== undefined && !isLockfile(row.file))
  if (rows.length === 0) return message('No tracked text files to count.')

  const table = totals(rows)
  const width = Math.max(...table.map(t => t.language.length)) + 2
  const filesWidth = Math.max(...table.map(t => `${t.files} ${t.files === 1 ? 'file' : 'files'}`.length)) + 2
  const sum = table.reduce((n, t) => n + t.lines, 0)
  return finish(
    [
      `Lines of tracked text files: ${sum} in ${rows.length} ${rows.length === 1 ? 'file' : 'files'}`,
      '',
      ...table.map(t => `${t.language.padEnd(width)}${`${t.files} ${t.files === 1 ? 'file' : 'files'}`.padEnd(filesWidth)}${t.lines} ${t.lines === 1 ? 'line' : 'lines'}`),
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'loc',
  description: 'Count lines of tracked text files by language, skipping lockfiles and binaries, and copy it',
  compose,
}
