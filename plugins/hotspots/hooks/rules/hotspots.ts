import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, groupBy, isRepo, lines, message, notARepo } from '../helpers'

const DAYS = 90
const TOP = 10

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  // An empty repo makes git log exit non-zero: the same answer as no changes.
  const files = lines(await tools.git('log', `--since=${DAYS} days ago`, '--no-merges', '--name-only', '--format='))
  if (files.length === 0) return message(`No file changes in the last ${DAYS} days.`)

  const ranked = groupBy(files, file => file)
    .map(([file, hits]) => ({ file, changes: hits.length }))
    .sort((a, b) => b.changes - a.changes || a.file.localeCompare(b.file))
    .slice(0, TOP)
  return finish([`Most changed files in the last ${DAYS} days`, '', ...ranked.map(r => `${r.changes}  ${r.file}`)].join('\n'))
}

export const rule: CommandRule = {
  name: 'hotspots',
  description: 'List the 10 files changed most often in the last 90 days, with change counts, and copy it',
  compose,
}
