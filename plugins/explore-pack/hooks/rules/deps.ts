import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, isRepo, message, notARepo, repoRoot } from '../helpers'
import { cargoDeps, goDeps, npmDeps, pyprojectDeps, requirementsDeps, type Dep } from '../manifests'

const MAX_ROWS = 100

type Source = { file: string; parse: (text: string) => Dep[] | undefined }

// The order the groups print in.
const SOURCES: readonly Source[] = [
  { file: 'package.json', parse: npmDeps },
  { file: 'pyproject.toml', parse: pyprojectDeps },
  { file: 'requirements.txt', parse: requirementsDeps },
  { file: 'go.mod', parse: goDeps },
  { file: 'Cargo.toml', parse: cargoDeps },
]

const row = (d: Dep): string => `  ${d.name}  ${d.version}${d.kind === undefined ? '' : `  (${d.kind})`}`

// A group is its header and rows. The rows are what the cap counts.
type Group = { header: string; rows: string[] }

const group = (file: string, deps: readonly Dep[] | undefined): Group =>
  deps === undefined
    ? { header: file, rows: ['  could not be parsed'] }
    : { header: `${file} (${deps.length})`, rows: deps.length === 0 ? ['  none'] : deps.map(row) }

// Keeps the first MAX_ROWS rows across all groups, then one "+N more" line.
// Groups are set apart by a blank line.
const limited = (groups: readonly Group[]): string[] => {
  const total = groups.reduce((sum, g) => sum + g.rows.length, 0)
  let budget = MAX_ROWS
  const shown = groups.flatMap(g => {
    if (budget <= 0) return []
    const rows = g.rows.slice(0, budget)
    budget -= rows.length
    return [['', g.header, ...rows]]
  })
  return [...shown.flat(), ...(total > MAX_ROWS ? ['', `+${total - MAX_ROWS} more`] : [])]
}

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const root = (await repoRoot(tools)) ?? (await tools.cwd())
  const found: Group[] = []
  for (const { file, parse } of SOURCES) {
    const text = await tools.read(`${root}/${file}`)
    if (text !== undefined) found.push(group(file, parse(text)))
  }
  if (found.length === 0) return message('No package.json, pyproject.toml, requirements.txt, go.mod or Cargo.toml at the repo root.')
  return finish(['Direct dependencies', ...limited(found)].join('\n'))
}

export const rule: CommandRule = {
  name: 'deps',
  description: 'List direct dependencies with versions from package.json, pyproject.toml, requirements.txt, go.mod and Cargo.toml, and copy it',
  compose,
}
