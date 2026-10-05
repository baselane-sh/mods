import type { CommandRule, CommandTools, Composed } from '../engine'
import { byPath, fileRows, hitsOf } from '../grep'
import { finish, isRepo, message, notARepo } from '../helpers'
import { SECRET_VALUE, SECRET_VALUE_ERE } from '../patterns'

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  // -o keeps the rows short. The matched text is read to confirm the shape
  // and dropped: the answer is a path and a line number, never the value.
  const hits = hitsOf(await tools.gitRun('grep', '-n', '-I', '-o', '--null', '-E', '-e', SECRET_VALUE_ERE)).filter(hit =>
    SECRET_VALUE.test(hit.text),
  )
  const files = byPath(hits)
  if (files.length === 0) return message('No secret-shaped text found in tracked files.')
  return finish(
    [
      `Tracked files with secret-shaped text: ${files.length}`,
      '',
      ...fileRows(files),
      '',
      'Values are never shown. Rotate any real credential, then remove it from history.',
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'secret-scan',
  description: 'List tracked files and line numbers that hold secret-shaped text (keys, tokens, URLs with passwords). Never prints a value',
  compose,
}
