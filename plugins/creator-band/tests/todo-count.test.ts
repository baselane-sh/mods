import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'todo-count')
  await ui.unmount()
  return found?.text
}

const GREP = ['git', '--no-optional-locks', 'grep', '-c', '--no-color', '-I', '-w', '-E', 'TODO|FIXME|HACK']

test('todo-count: the sum over the files, from the session start', async ($, on) => {
  const session = probe($, on)
  session.setCommand('git grep', { stdout: 'src/a.ts:3\nsrc/b.ts:4\nREADME.md:1\n' })
  await session.start()
  await session.settle()
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('todo 8')
  expect(session.calls('git grep')).toEqual([GREP])
})

test('todo-count: it is not git status, and the branch band does not run it', async ($, on) => {
  const session = probe($, on)
  session.setCommand('git grep', { stdout: 'a.ts:1\n' })
  await session.start()
  await session.settle()
  expect(session.gitRuns()).toBe(0)
})

test('todo-count: no match (exit 1), a failure, or a path with a colon', async ($, on) => {
  const session = probe($, on)
  session.setCommand('git grep', { exitCode: 1, stdout: '' })
  await session.start()
  await session.settle()
  expect(await read(session)).toBeUndefined()

  session.setCommand('git grep', { stdout: 'weird:name.ts:2\n' })
  await session.tool('Edit')
  expect(await read(session)).toBe('todo 2')

  session.setCommand('git grep', { exitCode: 128, stdout: '' })
  await session.tool('Edit')
  expect(await read(session)).toBeUndefined()

  session.setCommand('git grep', 'reject')
  await session.tool('Write')
  expect(await read(session)).toBeUndefined()
})

test('todo-count: an edit, a Write and a Bash call refresh it, a Read does not', async ($, on) => {
  const session = probe($, on)
  session.setCommand('git grep', { stdout: 'a.ts:1\n' })
  await session.tool('Read')
  await session.tool('Grep')
  expect(session.calls('git grep').length).toBe(0)
  for (const [tool, runs] of [['Edit', 1], ['Write', 2], ['MultiEdit', 3], ['NotebookEdit', 4]] as const) {
    await session.tool(tool)
    expect(session.calls('git grep').length).toBe(runs)
  }
  await session.bash('sed -i s/a/b/ x')
  expect(session.calls('git grep').length).toBe(5)
})

test('todo-count: the count follows the edits', async ($, on) => {
  const session = probe($, on)
  session.setCommand('git grep', { stdout: 'a.ts:1\n' })
  await session.tool('Edit')
  expect(await read(session)).toBe('todo 1')
  session.setCommand('git grep', { stdout: 'a.ts:1\nb.ts:2\n' })
  await session.tool('Edit')
  expect(await read(session)).toBe('todo 3')
  session.setCommand('git grep', { exitCode: 1, stdout: '' })
  await session.tool('Edit')
  expect(await read(session)).toBeUndefined()
})

test('todo-count: a denied call does not run it', async ($, on) => {
  const session = probe($, on)
  session.setCommand('git grep', { stdout: 'a.ts:1\n' })
  expect(await session.bash('echo DENYME')).toEqual({ deny: 'blocked by test' })
  expect(session.calls('git grep').length).toBe(0)
})

test('todo-count: one run at a time, an edit during a run starts one more after it', async ($, on) => {
  const session = probe($, on)
  session.setCommand('git grep', { stdout: 'a.ts:1\n', delayMs: 3000 })
  await session.tool('Edit')
  await session.tool('Edit')
  await session.tool('Write')
  expect(session.calls('git grep').length).toBe(1)
  await session.advance(3000)
  expect(session.calls('git grep').length).toBe(2)
  await session.advance(3000)
  expect(session.calls('git grep').length).toBe(2)
  expect(await read(session)).toBe('todo 1')
})

test('todo-count: a run uses a timeout, and a tool result does not wait for it', async ($, on) => {
  const session = probe($, on)
  session.setCommand('git grep', { stdout: 'a.ts:5\n', delayMs: 5000 })
  expect(await session.tool('Edit')).toEqual({ result: {} })
  expect(await read(session)).toBeUndefined()
  expect(session.timeouts('git grep')).toEqual([5000])
  await session.advance(5000)
  expect(await read(session)).toBe('todo 5')
})

test('todo-count: besides edits it reads again every five minutes', async ($, on) => {
  const session = probe($, on)
  session.setCommand('git grep', { stdout: 'a.ts:1\n' })
  await session.turn({})
  expect(session.calls('git grep').length).toBe(1)
  await session.advance(299_000)
  expect(session.calls('git grep').length).toBe(1)
  await session.advance(1000)
  expect(session.calls('git grep').length).toBe(2)
})

test('todo-count: drawing never writes state', async ($, on) => {
  const session = probe($, on)
  session.setCommand('git grep', { stdout: 'a.ts:1\n' })
  await session.tool('Edit')
  const before = session.stateWrites('fetched')
  await read(session)
  await read(session, 'desktop')
  expect(session.stateWrites('fetched')).toBe(before)
})
