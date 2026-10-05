import type { CommandRule, CommandTools, Composed } from '../engine'
import { count, finish, isRepo, lines, message, notARepo } from '../helpers'

const TOP = 15

type Author = { name: string; commits: number }

// "    42\tAda Lovelace" becomes an author. Other rows are dropped.
const parse = (row: string): Author | undefined => {
  const hit = /^\s*(\d+)\s+(.+)$/.exec(row)
  return hit === null ? undefined : { name: (hit[2] ?? '').trim(), commits: Number(hit[1]) }
}

// Newest commit first, so the first date seen for a name is its last commit.
const lastDates = (log: string | undefined): Map<string, string> => {
  const dates = new Map<string, string>()
  for (const row of lines(log)) {
    const [name, date] = row.split('\t')
    if (name !== undefined && date !== undefined && !dates.has(name)) dates.set(name, date)
  }
  return dates
}

// Names only. The git calls never ask for an address; this guards a name that
// is itself an address, or that carries one in angle brackets.
const shown = (name: string): string => name.replace(/<[^>]*>/g, '').replace(/\S+@\S+/g, '').trim() || '(hidden)'

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  // HEAD is explicit: shortlog with no revision reads stdin. An empty repo has
  // no HEAD, so git exits non-zero, the same answer as no commits.
  const authors = lines(await tools.git('shortlog', '-sn', '--no-merges', 'HEAD'))
    .map(parse)
    .filter((author): author is Author => author !== undefined)
  if (authors.length === 0) return message('No commits yet.')

  // On a very long history the date log can pass the output cap; the counts
  // still print, with unknown dates.
  const log = await tools.git('log', '--no-merges', '--format=%aN%x09%as').catch(() => undefined)
  const dates = lastDates(log)
  const total = authors.reduce((sum, author) => sum + author.commits, 0)
  const rest = authors.length - TOP
  return finish(
    [
      `Contributors by commits: ${count(authors.length, 'person').replace('persons', 'people')}, ${count(total, 'commit')}`,
      '',
      ...authors
        .slice(0, TOP)
        .map(a => `${count(a.commits, 'commit')}  ${shown(a.name)}  (last ${dates.get(a.name) ?? 'unknown'})`),
      ...(rest > 0 ? [`+${rest} more`] : []),
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'authors',
  description: 'List the top 15 contributors by commit count with their last commit date, names only, and copy it',
  compose,
}
