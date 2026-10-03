import type { CommandRecord } from '../../types'
import type { CommandRule, CommandTools } from '../engine'
import { bullets, count, finish, isRepo, lines } from '../helpers'

const MAX_FILES = 10
const MAX_COMMANDS = 5

// What I did yesterday, from git. Says why when it cannot know.
const yesterday = async (tools: CommandTools): Promise<string[]> => {
  const dir = await tools.cwd()
  if (!(await isRepo(tools))) return [`- Not a git repository: ${dir}, so no commits to list`]
  const email = (await tools.git('config', 'user.email'))?.trim()
  if (email === undefined || email === '') return ['- git user.email is not set, so commits cannot be listed']
  const commits = lines(await tools.git('log', '--since=yesterday', `--author=${email}`, '--no-merges', '--format=%h %s'))
  return commits.length === 0 ? [`- Nothing committed since yesterday by ${email}`] : commits.map(commit => `- ${commit}`)
}

const commandRows = (record: CommandRecord): string[] => {
  const shown = record.commands.slice(-MAX_COMMANDS)
  const earlier = record.commandsRun - shown.length
  return [`- Commands run (${record.commandsRun}):`, ...(earlier > 0 ? [`  - and ${earlier} more earlier`] : []), ...shown.map(c => `  - ${c}`)]
}

const today = (record: CommandRecord): string[] => {
  const rows = [
    ...(record.files.length === 0 ? [] : [`- Files touched (${record.files.length}):`, ...bullets(record.files, MAX_FILES, '  ')]),
    ...(record.commandsRun === 0 ? [] : commandRows(record)),
  ]
  return rows.length === 0 ? ['- Nothing recorded in this session yet'] : rows
}

const blockers = (record: CommandRecord): string[] => {
  const rows = [
    ...(record.blocked === 0 ? [] : [`- ${count(record.blocked, 'tool call')} blocked by a hook`]),
    ...(record.errored === 0 ? [] : [`- ${count(record.errored, 'tool call')} ended in an error`]),
  ]
  return rows.length === 0 ? ['- None'] : rows
}

const compose = async (record: CommandRecord, _facts: unknown, tools: CommandTools): Promise<string> =>
  finish(['Yesterday', ...(await yesterday(tools)), '', 'Today', ...today(record), '', 'Blockers', ...blockers(record)].join('\n'))

export const rule: CommandRule = {
  name: 'standup',
  description: 'Print a standup (Yesterday, Today, Blockers) from your git log and this session, and copy it',
  compose,
}
