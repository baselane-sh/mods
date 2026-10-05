import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, isRepo, lines, message, notARepo } from '../helpers'

const LIMIT = 15

// "2026-09-30\tabc1234\trefs/heads/main\tsubject". --source names the branch
// that reached the commit.
const row = (line: string): string => {
  const [date = '', hash = '', ref = '', ...subject] = line.split('\t')
  return `${date}  ${hash}  ${ref.replace(/^refs\/heads\//, '')}  ${subject.join('\t')}`.trimEnd()
}

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const name = ((await tools.git('config', 'user.name')) ?? '').trim()
  if (name === '') return message('git user.name is not set, so there is no author to match.')
  // -F: a name such as "J. (Dev)" is text, not a pattern.
  const log = await tools.git('log', '--branches', '--source', '-F', `--author=${name}`, '-n', String(LIMIT), '--format=%as%x09%h%x09%S%x09%s')
  // An empty repo has no branch to walk, so git exits non-zero.
  if (log === undefined) return message('No commits yet.')
  const found = lines(log)
  if (found.length === 0) return message(`No commits by ${name} on local branches.`)
  return finish([`Your last ${found.length} commits on local branches (${name})`, '', ...found.map(row)].join('\n'))
}

export const rule: CommandRule = {
  name: 'recent',
  description: 'List your last 15 commits across all local branches, matched on git user.name, with branch and date (read-only)',
  compose,
}
