import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, groupBy, isRepo, lines, message, notARepo } from '../helpers'

const MAX_LINES = 50
const MAX_TEXT = 120

type Hit = { file: string; line: string; text: string }

// "src/a.ts:12:  // TODO x" becomes a hit. A row without two colons is dropped.
const parse = (row: string): Hit | undefined => {
  const first = row.indexOf(':')
  const second = row.indexOf(':', first + 1)
  if (first < 1 || second < 0) return undefined
  return { file: row.slice(0, first), line: row.slice(first + 1, second), text: row.slice(second + 1).trim() }
}

const shorten = (text: string, room: number): string => (text.length <= room ? text : `${text.slice(0, room - 3)}...`)

// Groups keep git grep's file order.
const byFile = (hits: readonly Hit[]): [string, Hit[]][] =>
  groupBy(hits, hit => hit.file)

const section = ([file, rows]: [string, Hit[]]): string[] => [
  file,
  ...rows.map(hit => `  ${hit.line}: ${shorten(hit.text, MAX_TEXT - hit.line.length - 4)}`),
]

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const found = lines(await tools.git('grep', '-I', '-n', '-w', '-e', 'TODO', '-e', 'FIXME', '-e', 'HACK', '--', '.'))
    .map(parse)
    .filter((hit): hit is Hit => hit !== undefined)
  if (found.length === 0) return message('No TODO, FIXME or HACK lines in tracked files.')

  const files = byFile(found)
  const shown = byFile(found.slice(0, MAX_LINES))
  const rest = found.length - MAX_LINES
  return finish(
    [
      `TODO, FIXME and HACK: ${found.length} in ${files.length} ${files.length === 1 ? 'file' : 'files'}`,
      '',
      shown.map(section).map(rows => rows.join('\n')).join('\n\n'),
      ...(rest > 0 ? ['', `+${rest} more`] : []),
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'todos',
  description: 'List TODO, FIXME and HACK lines in tracked files, grouped by file (50 lines at most), and copy it',
  compose,
}
