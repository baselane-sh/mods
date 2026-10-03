import { expect, test } from 'claude-code/testing'

import { isLockfile, rule } from '../hooks/rules/lockfile'
import { NO_TOOLS } from './fixtures'
import { probe } from './probe'

const HITS = [
  'package-lock.json',
  '/repo/package-lock.json',
  '/repo/apps/web/pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
  'Cargo.lock',
  'poetry.lock',
  'uv.lock',
  'Gemfile.lock',
  'go.sum',
  'composer.lock',
  'C:\\repo\\yarn.lock',
]
const MISSES = ['package.json', '/repo/src/lock.ts', 'go.mod', 'Cargo.toml', 'my-yarn.lock.md', 'pyproject.toml', 'package-lock.json.md', '/repo/locks/readme.md']

test('lockfile-guard: file name table', () => {
  for (const path of HITS) expect({ path, hit: isLockfile(path) }).toEqual({ path, hit: true })
  for (const path of MISSES) expect({ path, hit: isLockfile(path) }).toEqual({ path, hit: false })
})

// path-jail rides in the same pack: the working directory exists, so a file in it is placed.
const FS = { '/repo': '/repo' }

test('lockfile-guard: asks for Write and Edit through the engine', async ($, on) => {
  const guard = probe($, on, { fs: FS })
  expect(await guard.answeredTool({ tool: 'Write', file_path: '/repo/package-lock.json', content: '{}' })).toBe(true)
  expect(await guard.answeredTool({ tool: 'Edit', file_path: '/repo/go.sum', old_string: 'a', new_string: 'b' })).toBe(true)
  expect(await guard.answeredTool({ tool: 'Write', file_path: '/repo/package.json', content: '{}' })).toBe(false)
})

test('lockfile-guard: reading and shell commands are not its business', async ($, on) => {
  const guard = probe($, on, { fs: FS })
  expect(await guard.answered('cat package-lock.json')).toBe(false)
  expect(await guard.answered('npm install')).toBe(false)
  expect(await guard.answeredTool({ tool: 'Read', file_path: '/repo/package-lock.json' })).toBe(false)
})

test('lockfile-guard: the reason names the file and the package manager', async () => {
  const reason = await rule.check({ tool: 'Write', tool_use_id: 't', file_path: '/repo/yarn.lock', content: '' }, NO_TOOLS)
  expect(reason).toContain('yarn.lock')
  expect(reason).toContain('package manager')
})
