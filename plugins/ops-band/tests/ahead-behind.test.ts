import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'ahead-behind')
  await ui.unmount()
  return found?.text
}

test('ahead-behind: the commits ahead and behind, after a Bash call', async ($, on) => {
  const session = probe($, on)
  session.setGit('## main...origin/main [ahead 2, behind 1]\n M a.ts\n')
  expect(await read(session)).toBeUndefined()
  await session.bash('git fetch')
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('↑2 ↓1')
})

test('ahead-behind: one side only, and level with the upstream', async ($, on) => {
  const session = probe($, on)
  session.setGit('## main...origin/main [ahead 3]\n')
  await session.bash('ls')
  expect(await read(session)).toBe('↑3 ↓0')
  session.setGit('## main...origin/main [behind 4]\n')
  await session.bash('ls')
  expect(await read(session)).toBe('↑0 ↓4')
  session.setGit('## main...origin/main\n')
  await session.bash('ls')
  expect(await read(session)).toBe('↑0 ↓0')
})

test('ahead-behind: no upstream, or one that is gone, hides it', async ($, on) => {
  const session = probe($, on)
  session.setGit('## main...origin/main [ahead 1]\n')
  await session.bash('ls')
  expect(await read(session)).toBe('↑1 ↓0')
  session.setGit('## feature\n M a.ts\n')
  await session.bash('ls')
  expect(await read(session)).toBeUndefined()
  session.setGit('## old...origin/old [gone]\n')
  await session.bash('ls')
  expect(await read(session)).toBeUndefined()
})

test('ahead-behind: a branch name that holds words of the counts is read by its brackets', async ($, on) => {
  const session = probe($, on)
  session.setGit('## ahead-5/behind-2...origin/ahead-5/behind-2 [ahead 7, behind 9]\n')
  await session.bash('ls')
  expect(await read(session)).toBe('↑7 ↓9')
})

test('ahead-behind: it follows the repository after an edit, and hides outside one', async ($, on) => {
  const session = probe($, on)
  session.setGit('## main...origin/main [ahead 1]\n')
  await session.bash('ls')
  session.setGit('## main...origin/main [ahead 2]\n')
  await session.tool('Edit')
  expect(await read(session)).toBe('↑2 ↓0')
  session.setGit(null)
  await session.bash('ls')
  expect(await read(session)).toBeUndefined()
})

test('ahead-behind: it runs only git status, after the calls that can change it', async ($, on) => {
  const session = probe($, on)
  await session.tool('Read')
  await session.advance(600_000)
  expect(session.gitRuns()).toBe(0)
  await session.bash('ls')
  expect(session.gitRuns()).toBe(1)
  expect(session.calls('git grep')).toEqual([])
})

test('ahead-behind: a denied call does not run git, and stays denied', async ($, on) => {
  const session = probe($, on)
  expect(await session.bash('echo DENYME')).toEqual({ deny: 'blocked by test' })
  expect(session.gitRuns()).toBe(0)
})

test('ahead-behind: a tool result does not wait for git', async ($, on) => {
  const session = probe($, on)
  session.slowGit(5000, '## main...origin/main [ahead 1]\n')
  expect(await session.bash('ls')).toEqual({ result: {} })
  expect(await read(session)).toBeUndefined()
  await session.advance(5000)
  expect(await read(session)).toBe('↑1 ↓0')
})
