import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'branch-band')
  await ui.unmount()
  return found?.text
}

test('branch-band: the branch and the changed files, after a Bash call', async ($, on) => {
  const session = probe($, on)
  expect(await read(session)).toBeUndefined()
  await session.bash('ls')
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('main · 2 changed')
})

test('branch-band: a Bash call, an Edit and a Write each refresh it', async ($, on) => {
  const session = probe($, on)
  const seen: [string, number][] = []
  for (const run of [() => session.bash('ls'), () => session.tool('Edit'), () => session.tool('Write')]) {
    await run()
    seen.push(['run', session.gitRuns()])
  }
  expect(seen).toEqual([['run', 1], ['run', 2], ['run', 3]])
})

test('branch-band: a Read, a Grep or a time passing do not run git', async ($, on) => {
  const session = probe($, on)
  await session.tool('Read')
  await session.tool('Grep')
  await session.advance(600_000)
  expect(session.gitRuns()).toBe(0)
})

test('branch-band: it follows the repository after a later call', async ($, on) => {
  const session = probe($, on)
  await session.bash('git checkout dev')
  session.setGit('## dev\n')
  await session.bash('git checkout dev')
  expect(await read(session)).toBe('dev · clean')
  session.setGit('## dev\n M a.ts\n')
  await session.tool('Edit')
  expect(await read(session)).toBe('dev · 1 changed')
})

test('branch-band: a detached head and a repository with no commit', async ($, on) => {
  const session = probe($, on)
  session.setGit('## HEAD (no branch)\n')
  await session.bash('ls')
  expect(await read(session)).toBe('detached · clean')
  session.setGit('## No commits yet on trunk\n?? a.ts\n')
  await session.bash('ls')
  expect(await read(session)).toBe('trunk · 1 changed')
})

test('branch-band: the upstream and ahead counts stay out of the name', async ($, on) => {
  const session = probe($, on)
  session.setGit('## feat/x...origin/feat/x [ahead 2, behind 1]\n')
  await session.bash('ls')
  expect(await read(session)).toBe('feat/x · clean')
})

test('branch-band: outside a repository the segment is hidden', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  expect(await read(session)).toBeDefined()
  session.setGit(null)
  await session.bash('ls')
  expect(await read(session)).toBeUndefined()
})

test('branch-band: a denied call does not run git, and stays denied', async ($, on) => {
  const session = probe($, on)
  expect(await session.bash('echo DENYME')).toEqual({ deny: 'blocked by test' })
  expect(session.gitRuns()).toBe(0)
})

test('branch-band: drawing never writes state', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  const before = session.stateWrites('git')
  await read(session)
  await read(session, 'desktop')
  expect(session.stateWrites('git')).toBe(before)
})

test('branch-band: a tool result does not wait for git', async ($, on) => {
  const session = probe($, on)
  session.slowGit(5000, '## main\n')
  // The clock stands still, so a call that waited for git would never answer.
  expect(await session.bash('ls')).toEqual({ result: {} })
  expect(session.gitRuns()).toBe(1)
  expect(await read(session)).toBeUndefined()
  await session.advance(5000)
  expect(await read(session)).toBe('main · clean')
})

test('branch-band: a slow git read never overwrites a newer one', async ($, on) => {
  const session = probe($, on)
  session.slowGit(1000, '## main\n')
  const first = session.bash('git checkout dev')
  await session.settle()
  session.setGit('## dev\n')
  await session.bash('ls')
  await session.advance(1000)
  await first
  expect(await read(session)).toBe('dev · clean')
})
