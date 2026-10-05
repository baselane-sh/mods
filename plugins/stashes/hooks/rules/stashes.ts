import type { CommandRule, CommandTools, Composed } from '../engine'
import { bullets, finish, isRepo, lines, message, notARepo } from '../helpers'

const LIMIT = 30

// "WIP on main: abc1234 subject" or "On main: my message".
const BRANCH = /^(?:WIP on|On) (.+?): (.*)$/

const row = (line: string): string => {
  const [ref = '', age = '', subject = ''] = line.split('\t')
  const hit = BRANCH.exec(subject)
  const branch = hit?.[1] ?? 'unknown branch'
  const note = hit?.[2] ?? subject
  return `${ref}  ${age}  ${branch}  ${note}`.trimEnd()
}

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const stashes = lines(await tools.git('stash', 'list', '--format=%gd%x09%cr%x09%gs'))
  if (stashes.length === 0) return message('No stashes.')
  return finish([`Stashes: ${stashes.length}`, '', ...bullets(stashes.map(row), LIMIT)].join('\n'))
}

export const rule: CommandRule = {
  name: 'stashes',
  description: 'List git stashes with their age and the branch each was made on (read-only, never applies or drops)',
  compose,
}
