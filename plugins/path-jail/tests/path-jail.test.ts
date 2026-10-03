import { expect, test } from 'claude-code/testing'

import type { GuardTools } from '../hooks/engine'
import { rule } from '../hooks/rules/path-jail'
import { NO_TOOLS } from './fixtures'
import { CWD, probe } from './probe'

// The files that exist, by path, each with where it really lands.
const EXISTING = {
  '/repo': '/repo',
  '/repo/src': '/repo/src',
  '/repo/src/app.ts': '/repo/src/app.ts',
  '/repo/link': '/etc',
  '/repo/link/passwd': '/etc/passwd',
  '/repo-other': '/repo-other',
  '/etc': '/etc',
  '/etc/hosts': '/etc/hosts',
  '/Users/me/.ssh': '/Users/me/.ssh',
  '/tmp': '/private/tmp',
  '/private/tmp': '/private/tmp',
  '/private/tmp/claude-502': '/private/tmp/claude-502',
  '/private/tmp/claude-502/scratch': '/private/tmp/claude-502/scratch',
  '/private/tmp/other': '/private/tmp/other',
}

const write = (file_path: string) => ({ tool: 'Write', file_path, content: 'x' }) as const
const envelope = (file_path: string) => ({ ...write(file_path), tool_use_id: 't' })

const INSIDE = [
  '/repo/src/app.ts',
  '/repo/src/new.ts',
  '/repo/brand/new/dir/file.ts',
  '/repo/src/../src/app.ts',
  'src/app.ts',
  'src/new.ts',
  './src/new.ts',
  '/private/tmp/claude-502/scratch/out.json',
  '/tmp/claude-502/scratch/out.json',
  '/private/tmp/claude-502/scratch/deep/new/file.txt',
]
const OUTSIDE = [
  '/etc/hosts',
  '/etc/new.conf',
  '/repo-other/file.ts',
  '/repo/../etc/hosts',
  '/repo/src/../../etc/hosts',
  '/repo/link/passwd',
  '/repo/link/new-file',
  '../sibling/file.ts',
  '/Users/me/.ssh/authorized_keys',
  '/Users/me/newdir/file',
  '~/notes.md',
  '/private/tmp/other/x.txt',
  '/tmp/x.txt',
  '/private/tmp/claude-502-evil/x.txt',
]

test('path-jail: asks for Write outside the working directory and passes inside', async ($, on) => {
  const guard = probe($, on, { fs: EXISTING })
  for (const path of INSIDE) expect({ path, answered: await guard.answeredTool(write(path)) }).toEqual({ path, answered: false })
  for (const path of OUTSIDE) expect({ path, answered: await guard.answeredTool(write(path)) }).toEqual({ path, answered: true })
})

test('path-jail: Edit and NotebookEdit are watched, Read and Bash are not', async ($, on) => {
  const guard = probe($, on, { fs: EXISTING })
  expect(await guard.answeredTool({ tool: 'Edit', file_path: '/etc/hosts', old_string: 'a', new_string: 'b' })).toBe(true)
  expect(await guard.answeredTool({ tool: 'NotebookEdit', notebook_path: '/etc/n.ipynb', new_source: 'x' })).toBe(true)
  expect(await guard.answeredTool({ tool: 'NotebookEdit', notebook_path: '/repo/src/n.ipynb', new_source: 'x' })).toBe(false)
  expect(await guard.answeredTool({ tool: 'Read', file_path: '/etc/hosts' })).toBe(false)
  expect(await guard.answered('echo hi > /etc/hosts')).toBe(false)
})

const toolsWith = (fs: Record<string, string>, cwd = CWD): GuardTools => ({
  ...NO_TOOLS,
  cwd: async () => cwd,
  realPath: async path => fs[path],
})

test('path-jail: a working directory that is itself a link is compared by real path', async () => {
  const tools = toolsWith({ '/work': '/real/work', '/work/a.ts': '/real/work/a.ts', '/real/work': '/real/work' }, '/work')
  expect(await rule.check(envelope('/work/a.ts'), tools)).toBeUndefined()
  expect(await rule.check(envelope('/real/work/new.ts'), tools)).toBeUndefined()
  expect(await rule.check(envelope('/elsewhere/new.ts'), tools)).toBeDefined()
})

test('path-jail: nothing resolvable fails closed', async () => {
  expect(await rule.check(envelope('/repo/a.ts'), toolsWith({}))).toBeDefined()
  expect(await rule.check(envelope('/nope/a/b.ts'), toolsWith({ '/repo': '/repo' }))).toBeDefined()
})

test('path-jail: the reason names the real destination and the working directory', async () => {
  const reason = await rule.check(envelope('/repo/link/passwd'), toolsWith(EXISTING))
  expect(reason).toContain('/etc/passwd')
  expect(reason).toContain('/repo')
})
