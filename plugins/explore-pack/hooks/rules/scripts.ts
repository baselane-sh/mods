import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, isRepo, message, notARepo, repoRoot } from '../helpers'
import { justRecipes, makeTargets, npmScripts, pyScripts, type Task } from '../tasks'

const MAX_ROWS = 100
const MAX_ROW = 100

// Case variants git users meet: GNU make reads makefile, just reads Justfile.
type Source = { label: string; files: readonly string[]; parse: (text: string) => Task[] | undefined }

// The order the groups print in.
const SOURCES: readonly Source[] = [
  { label: 'package.json', files: ['package.json'], parse: npmScripts },
  { label: 'Makefile', files: ['Makefile', 'makefile', 'GNUmakefile'], parse: makeTargets },
  { label: 'justfile', files: ['justfile', 'Justfile', '.justfile'], parse: justRecipes },
  { label: 'pyproject.toml', files: ['pyproject.toml'], parse: pyScripts },
]

const shorten = (text: string): string => (text.length <= MAX_ROW ? text : `${text.slice(0, MAX_ROW - 3)}...`)

const row = (t: Task): string => shorten(`  ${t.name}${t.detail === undefined ? '' : `  ${t.detail}`}`)

type Group = { header: string; rows: string[] }

const firstFound = async (root: string, files: readonly string[], tools: CommandTools): Promise<string | undefined> => {
  for (const file of files) {
    const text = await tools.read(`${root}/${file}`)
    if (text !== undefined) return text
  }
  return undefined
}

// Keeps the first MAX_ROWS rows across all groups, then one "+N more" line.
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
  const groups: Group[] = []
  for (const { label, files, parse } of SOURCES) {
    const text = await firstFound(root, files, tools)
    if (text === undefined) continue
    const tasks = parse(text)
    if (tasks === undefined) groups.push({ header: label, rows: ['  could not be parsed'] })
    else if (tasks.length > 0) groups.push({ header: `${label} (${tasks.length})`, rows: tasks.map(row) })
  }
  if (groups.length === 0) {
    return message('No runnable tasks: no package.json scripts, Makefile targets, justfile recipes or pyproject scripts found at the repo root.')
  }
  return finish(['Runnable tasks', ...limited(groups)].join('\n'))
}

export const rule: CommandRule = {
  name: 'scripts',
  description: 'List runnable tasks: package.json scripts, Makefile targets, justfile recipes and pyproject scripts, and copy it',
  compose,
}
