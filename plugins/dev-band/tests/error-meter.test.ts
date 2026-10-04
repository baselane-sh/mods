import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'error-meter')
  await ui.unmount()
  return found === undefined ? undefined : { text: found.text, color: found.color }
}

test('error-meter: hidden before the first tool call', async ($, on) => {
  const session = probe($, on)
  for (const surface of SURFACES) expect(await read(session, surface)).toBeUndefined()
})

test('error-meter: clean calls read 0 failed with no color', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  for (const surface of SURFACES) expect(await read(session, surface)).toEqual({ text: '0 failed', color: undefined })
})

test('error-meter: an error counts, names its tool and turns red', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  await session.bash('echo FAILME')
  for (const surface of SURFACES) expect(await read(session, surface)).toEqual({ text: '1 failed · last Bash', color: 'red' })
})

test('error-meter: a deny counts as a failure', async ($, on) => {
  const session = probe($, on)
  await session.bash('echo DENYME')
  expect((await read(session))?.text).toBe('1 failed · last Bash')
})

test('error-meter: the last failing tool is the most recent one', async ($, on) => {
  const session = probe($, on)
  session.failTool('Read')
  session.failTool('mcp__lab__run')
  await session.bash('echo FAILME')
  await session.tool('Read')
  await session.tool('Edit')
  expect((await read(session))?.text).toBe('2 failed · last Read')
  await session.tool('mcp__lab__run')
  expect((await read(session))?.text).toBe('3 failed · last run')
})

test('error-meter: the count is the whole session, not a window', async ($, on) => {
  const session = probe($, on)
  await session.bash('echo FAILME')
  for (let i = 0; i < 30; i += 1) await session.bash('ls')
  expect((await read(session))?.text).toBe('1 failed · last Bash')
})

test('error-meter: a turn end does not wipe it', async ($, on) => {
  const session = probe($, on)
  await session.bash('echo FAILME')
  await session.turn({ usd: 1, percent: 10 })
  expect((await read(session))?.text).toBe('1 failed · last Bash')
})

test('error-meter: it leaves the tool result as it was', async ($, on) => {
  const session = probe($, on)
  expect(await session.bash('echo DENYME')).toEqual({ deny: 'blocked by test' })
  expect(await session.bash('echo FAILME')).toMatchObject({ isError: true })
})
