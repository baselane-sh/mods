import { expect, test } from 'claude-code/testing'

import { rule, tagDangersIn } from '../hooks/rules/tag'
import { NO_TOOLS } from './fixtures'
import { probe } from './probe'

// A repo at /repo whose local tags are v1.2.0 and release-7.
const GIT = {
  'rev-parse --is-inside-work-tree': 'true\n',
  'show-ref --verify --quiet refs/tags/v1.2.0': '',
  'show-ref --verify --quiet refs/tags/release-7': '',
}
const isTag = async (name: string) => name === 'v1.2.0' || name === 'release-7'
const noTags = async () => false

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['git push --tags', 'git push --tags'],
  ['git push origin --tags', 'git push --tags'],
  ['git push --follow-tags origin main', 'git push --follow-tags'],
  ['git push --mirror backup', 'git push --mirror'],
  ['git push origin v1.2.0', 'push tag v1.2.0'],
  ['git push origin release-7:release-7', 'push tag release-7'],
  ['git push -f origin +v1.2.0', 'push tag v1.2.0'],
  ['git push origin refs/tags/v2.0.0', 'push tag refs/tags/v2.0.0'],
  ['git push origin tag v3.0.0', 'push tag v3.0.0'],
  ['git push origin HEAD:refs/tags/v3.2.0', 'push tag refs/tags/v3.2.0'],
  ['git push origin :refs/tags/v0.9.0', 'delete remote tag refs/tags/v0.9.0'],
  ['git push --delete origin v1.2.0', 'delete remote tag v1.2.0'],
  ['git tag -d v0.9.0 && git push origin :v0.9.0', 'delete remote tag v0.9.0'],
  ['git tag -d v0.9.0 && git push --delete origin v0.9.0', 'delete remote tag v0.9.0'],
  ['git -C /repo push origin v1.2.0', 'push tag v1.2.0'],
  ['git tag v3.1.0 && git push origin v3.1.0', 'push tag v3.1.0'],
  ['git tag -a v3.1.0 -m rel && git push origin main v3.1.0', 'push tag v3.1.0'],
]
const MISSES = [
  'git push',
  'git push origin main',
  'git push -u origin feature/login',
  'git push origin HEAD',
  'git push --dry-run --tags',
  'git push -n origin v1.2.0',
  'git push --delete origin old-branch',
  'git tag v3.0.0',
  'git tag -a v3.0.0 -m "release"',
  'git tag -d v0.9.0',
  'git tag -l',
  'git fetch --tags',
  'echo "git push --tags"',
  'grep "push origin :refs/tags" NOTES.md',
]

test('tag-guard: command table', async () => {
  for (const [command, name] of HITS) expect({ command, found: await tagDangersIn(command, isTag) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: await tagDangersIn(command, isTag) }).toEqual({ command, found: [] })
})

test('tag-guard: a tag made earlier in the same command counts before it exists', async () => {
  expect(await tagDangersIn('git tag v3.1.0 && git push origin v3.1.0 main', noTags)).toEqual(['push tag v3.1.0'])
  expect(await tagDangersIn('git tag -m "rel" -a v3.1.0 HEAD~1 && git push origin v3.1.0', noTags)).toEqual(['push tag v3.1.0'])
  expect(await tagDangersIn('git tag -f v3.1.0 && git push -f origin v3.1.0', noTags)).toEqual(['push tag v3.1.0'])
  expect(await tagDangersIn('git tag -l v3.1.0 && git push origin v3.1.0', noTags)).toEqual([])
  expect(await tagDangersIn('git tag -m v3.1.0 rel && git push origin v3.1.0', noTags)).toEqual([])
})

test('tag-guard: a bare name is a branch when the repo has no such tag', async () => {
  expect(await tagDangersIn('git push origin v1.2.0', noTags)).toEqual([])
  expect(await tagDangersIn('git push origin refs/tags/v1.2.0', noTags)).toEqual(['push tag refs/tags/v1.2.0'])
})

test('tag-guard: outside a repo only the spelled-out tag pushes ask', async () => {
  expect(await rule.check({ tool: 'Bash', command: 'git push origin v1.2.0', tool_use_id: 't' }, NO_TOOLS)).toBeUndefined()
  expect(await rule.check({ tool: 'Bash', command: 'git push --tags', tool_use_id: 't' }, NO_TOOLS)).toBeDefined()
})

test('tag-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on, { git: GIT })
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
