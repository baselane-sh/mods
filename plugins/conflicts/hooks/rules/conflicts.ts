import type { CommandRule, CommandTools, Composed } from '../engine'
import { byPath, fileRows, hitsOf } from '../grep'
import { count, finish, isRepo, message, notARepo } from '../helpers'

// A marker line: <<<<<<< or >>>>>>> alone or with a label, or a bare =======.
const MARKER = '^(<<<<<<<|>>>>>>>)([[:space:]].*)?$|^=======[[:space:]]*$'

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const hits = hitsOf(await tools.gitRun('grep', '-n', '-I', '--null', '-E', '-e', MARKER))
  // A lone ======= is also an RST or setext heading, so a file counts only
  // when it has an opening <<<<<<< line.
  const opened = new Set(hits.filter(hit => hit.text.startsWith('<<<<<<<')).map(hit => hit.path))
  const files = byPath(hits.filter(hit => opened.has(hit.path)))
  if (files.length === 0) return message('No conflict markers in tracked files.')
  return finish([`Tracked files with conflict markers: ${files.length}`, '', ...fileRows(files)].join('\n'))
}

export const rule: CommandRule = {
  name: 'conflicts',
  description: 'List tracked files that still hold merge conflict markers, with line numbers (read-only)',
  compose,
}
