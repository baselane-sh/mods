import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, isRepo, lines, message, notARepo } from '../helpers'

const BASES = ['main', 'master']
const TYPE_PREFIX = /^(feat|fix|docs|refactor|test|chore|perf|ci|build|style)\/(.+)$/
const SHORT_HASH = 7

const words = (slug: string): string => slug.replace(/[-_]+/g, ' ').trim()

// `feat/add-login` becomes "feat: add login"; `mohammad/fix-bug_42` and
// `fix-bug_42` become "Fix bug 42". Undefined when the branch says nothing
// (the base itself or a detached HEAD), so the first commit names the PR.
const titleFromBranch = (branch: string): string | undefined => {
  if (branch === '' || branch === 'HEAD' || BASES.includes(branch)) return undefined
  const typed = TYPE_PREFIX.exec(branch)
  if (typed?.[1] !== undefined && typed[2] !== undefined) return `${typed[1]}: ${words(typed[2])}`
  const sentence = words(branch.slice(branch.lastIndexOf('/') + 1))
  return sentence === '' ? undefined : `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`
}

const findBase = async (tools: CommandTools): Promise<string | undefined> => {
  for (const base of BASES) {
    if ((await tools.git('rev-parse', '--verify', '--quiet', base)) !== undefined) return base
  }
  return undefined
}

const totals = (stat: string | undefined): string =>
  lines(stat).findLast(line => /files? changed/.test(line))?.trim() ?? 'No file changes'

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const branch = ((await tools.git('rev-parse', '--abbrev-ref', 'HEAD')) ?? '').trim()
  const base = await findBase(tools)
  if (base === undefined) return message('No main or master branch found, so there is no base to compare against.')
  const mergeBase = (await tools.git('merge-base', 'HEAD', base))?.trim()
  if (mergeBase === undefined || mergeBase === '') return message(`No merge base between HEAD and ${base}, so there is nothing to compare.`)

  const subjects = lines(await tools.git('log', `${mergeBase}..HEAD`, '--reverse', '--no-merges', '--format=%s'))
  if (subjects.length === 0) return message(`Branch ${branch === '' ? 'HEAD' : branch} has no commits ahead of ${base}. Nothing to describe.`)

  const title = titleFromBranch(branch) ?? subjects[0] ?? ''
  const stat = totals(await tools.git('diff', '--stat', mergeBase, 'HEAD'))
  return finish(
    [
      `Title: ${title}`,
      `Base: ${base} (merge base ${mergeBase.slice(0, SHORT_HASH)})`,
      '',
      '## Summary',
      ...subjects.map(subject => `- ${subject}`),
      '',
      '## Changes',
      stat,
      '',
      '## Test plan',
      '- [ ] Automated tests pass',
      '- [ ] Main flow checked by hand',
      '- [ ] Edge cases and error paths checked',
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'pr-description',
  description: 'Print a pull request description for this branch against main or master, and copy it',
  compose,
}
