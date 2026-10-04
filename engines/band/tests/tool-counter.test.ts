import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'tool-counter')
  await ui.unmount()
  return found?.text
}

const call = async (session: ReturnType<typeof probe>, name: string, times: number) => {
  for (let i = 0; i < times; i += 1) await session.tool(name)
}

test('tool-counter: hidden before the first tool call', async ($, on) => {
  const session = probe($, on)
  for (const surface of SURFACES) expect(await read(session, surface)).toBeUndefined()
})

test('tool-counter: the top three tools by calls, most first, on every surface', async ($, on) => {
  const session = probe($, on)
  await call(session, 'Read', 3)
  await call(session, 'Bash', 5)
  await call(session, 'Edit', 4)
  await call(session, 'Grep', 1)
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('Bash 5 · Edit 4 · Read 3')
})

test('tool-counter: fewer than three tools show what there is', async ($, on) => {
  const session = probe($, on)
  await call(session, 'Read', 2)
  expect(await read(session)).toBe('Read 2')
})

test('tool-counter: a tie keeps the tool seen first ahead', async ($, on) => {
  const session = probe($, on)
  await call(session, 'Write', 1)
  await call(session, 'Read', 1)
  await call(session, 'Edit', 1)
  await call(session, 'Grep', 1)
  expect(await read(session)).toBe('Write 1 · Read 1 · Edit 1')
})

test('tool-counter: a failed and a denied call still count', async ($, on) => {
  const session = probe($, on)
  await session.bash('echo FAILME')
  await session.bash('echo DENYME')
  expect(await read(session)).toBe('Bash 2')
})

test('tool-counter: an MCP tool is named by its last part', async ($, on) => {
  const session = probe($, on)
  await call(session, 'mcp__lab__run', 2)
  await call(session, 'mcp__other__run', 1)
  expect(await read(session)).toBe('run 3')
})

test('tool-counter: it leaves the tool result as it was', async ($, on) => {
  const session = probe($, on)
  expect(await session.bash('echo DENYME')).toEqual({ deny: 'blocked by test' })
  expect(await session.bash('echo FAILME')).toMatchObject({ isError: true })
})

test('tool-counter: a turn end does not wipe it', async ($, on) => {
  const session = probe($, on)
  await call(session, 'Read', 2)
  await session.turn({ usd: 1, percent: 10 })
  expect(await read(session)).toBe('Read 2')
})
