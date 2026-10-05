import type { CommandRule, CommandTools, Composed } from '../engine'
import { count, finish, isRepo, lines, message, notARepo } from '../helpers'

const TOP = 5
// A folder is read file by file; past this the answer says it sampled.
const MAX_FILES = 40

// `author Ada Lovelace` heads each source line in --line-porcelain output. A
// content line starts with a tab, so it can never look like this.
const AUTHOR = /^author (.+)$/
const UNCOMMITTED = 'Not Committed Yet'

// Names only: a name that is an address, or carries one, loses it.
const shown = (name: string): string => name.replace(/<[^>]*>/g, '').replace(/\S+@\S+/g, '').trim() || '(hidden)'

const tally = (porcelain: string, into: ReadonlyMap<string, number>): Map<string, number> => {
  const next = new Map(into)
  for (const row of porcelain.split('\n')) {
    const name = AUTHOR.exec(row)?.[1]
    if (name !== undefined && name !== UNCOMMITTED) next.set(name, (next.get(name) ?? 0) + 1)
  }
  return next
}

const clean = (typed: string): string => typed.replace(/^(["'])(.*)\1$/, '$2')

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools, args: string): Promise<Composed> => {
  const path = clean(args)
  if (path === '') return message('Usage: /owners <path>  (a file or a folder in this repo)')
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())

  // After `--` a path is never read as an option.
  const files = lines(await tools.git('ls-files', '--', path))
  if (files.length === 0) return message(`No tracked file or folder matches: ${path}`)

  const sampled = files.slice(0, MAX_FILES)
  let owners = new Map<string, number>()
  let skipped = 0
  for (const file of sampled) {
    try {
      const blame = await tools.git('blame', '--line-porcelain', '--', file)
      if (blame === undefined) skipped += 1
      else owners = tally(blame, owners)
    } catch {
      // Output past the cap: the file is left out, and the answer says so.
      skipped += 1
    }
  }
  if (owners.size === 0) return message(`No committed lines to attribute in: ${path}`)

  const total = [...owners.values()].reduce((sum, n) => sum + n, 0)
  const top = [...owners].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, TOP)
  const notes = [
    ...(files.length > sampled.length ? [`Read the first ${MAX_FILES} of ${count(files.length, 'file')}.`] : []),
    ...(skipped > 0 ? [`Left out ${count(skipped, 'file')} that could not be blamed.`] : []),
  ]
  return finish(
    [
      `Top authors of ${path} by lines (${count(total, 'line')} in ${count(sampled.length - skipped, 'file')})`,
      '',
      ...top.map(([name, n]) => `${count(n, 'line')}  ${shown(name)}`),
      ...(notes.length > 0 ? ['', ...notes] : []),
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'owners',
  description: 'Show the top 5 authors of a file or folder by lines (git blame, names only). Usage: /owners <path>',
  compose,
}
