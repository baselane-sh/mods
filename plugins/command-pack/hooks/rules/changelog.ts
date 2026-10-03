import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, isRepo, lines, message, notARepo } from '../helpers'

const LAST_N = 30

// Groups in print order. Anything not named here lands in `other`.
const GROUPS = [
  { type: 'feat', title: 'Features' },
  { type: 'fix', title: 'Fixes' },
  { type: 'docs', title: 'Documentation' },
  { type: 'refactor', title: 'Refactoring' },
  { type: 'test', title: 'Tests' },
  { type: 'chore', title: 'Chores' },
  { type: 'other', title: 'Other' },
] as const

type Entry = { type: string; text: string }

const CONVENTIONAL = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?:\s+(.+)$/

// "a1b2c3d feat(ui)!: add x" becomes a feat entry. A subject that is not
// conventional, or names another type, is kept whole under other.
const entry = (commit: string): Entry => {
  const space = commit.indexOf(' ')
  const hash = space < 0 ? commit : commit.slice(0, space)
  const subject = space < 0 ? '' : commit.slice(space + 1)
  const match = CONVENTIONAL.exec(subject)
  const type = match?.[1]?.toLowerCase() ?? ''
  if (match === undefined || match === null || !GROUPS.some(group => group.type === type && type !== 'other')) {
    return { type: 'other', text: `${subject} (${hash})` }
  }
  const scope = match[2] === undefined || match[2] === '' ? '' : `**${match[2]}:** `
  const breaking = match[3] === undefined ? '' : 'BREAKING: '
  return { type, text: `${scope}${breaking}${match[4]} (${hash})` }
}

const render = (heading: string, commits: readonly string[]): string => {
  const entries = commits.map(entry)
  const sections = GROUPS.flatMap(({ type, title }) => {
    const mine = entries.filter(e => e.type === type)
    return mine.length === 0 ? [] : [[`### ${title}`, ...mine.map(e => `- ${e.text}`)].join('\n')]
  })
  return [heading, ...sections].join('\n\n')
}

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const tag = (await tools.git('describe', '--tags', '--abbrev=0'))?.trim()
  const hasTag = tag !== undefined && tag !== ''
  const commits = lines(
    hasTag
      ? await tools.git('log', `${tag}..HEAD`, '--no-merges', '--format=%h %s')
      : await tools.git('log', `-${LAST_N}`, '--no-merges', '--format=%h %s'),
  )
  if (!hasTag && commits.length === 0) return message('No commits found.')
  if (hasTag && commits.length === 0) return message(`No commits since ${tag}.`)
  const heading = hasTag ? `## Changelog since ${tag}` : `## Changelog (last ${LAST_N} commits, no tag)`
  return finish(render(heading, commits))
}

export const rule: CommandRule = {
  name: 'changelog',
  description: 'Print a Markdown changelog since the last tag (or the last 30 commits), grouped by type, and copy it',
  compose,
}
