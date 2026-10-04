import type { CommandRule, CommandTools, Composed } from '../engine'
import { count, finish, isRepo, lines, message, notARepo } from '../helpers'

const DEPTH = 2
const MAX_LINES = 80
// The header and its blank line come out of the budget.
const ROOM = MAX_LINES - 2

type Node = { dirs: Map<string, Node>; files: string[]; total: number }

const empty = (): Node => ({ dirs: new Map(), files: [], total: 0 })

// Built in place: every file touches each folder above it once.
const build = (paths: readonly string[]): Node => {
  const root = empty()
  for (const path of paths) {
    const parts = path.split('/')
    let here = root
    here.total += 1
    for (const dir of parts.slice(0, -1)) {
      const next = here.dirs.get(dir) ?? empty()
      here.dirs.set(dir, next)
      here = next
      here.total += 1
    }
    here.files.push(parts[parts.length - 1] ?? path)
  }
  return root
}

// Code-point order, so the output does not change with the locale.
const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

// Folders first, then files. A folder below the depth limit is one row.
const rows = (node: Node, depth: number): string[] => {
  const indent = '  '.repeat(depth - 1)
  const dirs = [...node.dirs].sort(([a], [b]) => byName(a, b))
  return [
    ...dirs.flatMap(([name, child]) => [
      `${indent}${name}/ (${count(child.total, 'file')})`,
      ...(depth < DEPTH ? rows(child, depth + 1) : []),
    ]),
    ...(depth <= DEPTH ? [...node.files].sort(byName).map(file => `${indent}${file}`) : []),
  ]
}

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const paths = lines(await tools.git('ls-files'))
  if (paths.length === 0) return message('No tracked files.')

  const all = rows(build(paths), 1)
  // One row of the budget goes to "+N more" when the tree does not fit.
  const shown = all.length > ROOM ? [...all.slice(0, ROOM - 1), `+${all.length - (ROOM - 1)} more`] : all
  return finish([`Tracked files: ${paths.length}`, '', ...shown].join('\n'))
}

export const rule: CommandRule = {
  name: 'tree',
  description: 'Show tracked files as a tree, 2 levels deep, folders with file counts (80 lines at most), and copy it',
  compose,
}
