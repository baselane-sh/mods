import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'battery-band')
  await ui.unmount()
  return found
}

const BATT = (percent: number, state: string) =>
  `Now drawing from '${state === 'discharging' ? 'Battery' : 'AC'} Power'\n -InternalBattery-0 (id=1234)\t${percent}%; ${state}; 1:02 remaining present: true\n`

test('battery-band: the percent and the charging state from pmset', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pmset', { stdout: BATT(87, 'discharging') })
  await session.turn({})
  for (const surface of SURFACES) expect((await read(session, surface))?.text).toBe('🔋 87%')

  session.setCommand('pmset', { stdout: BATT(54, 'charging') })
  await session.advance(60_000)
  expect((await read(session))?.text).toBe('⚡ 54%')

  session.setCommand('pmset', { stdout: BATT(100, 'charged') })
  await session.advance(60_000)
  expect((await read(session))?.text).toBe('🔌 100%')

  session.setCommand('pmset', { stdout: BATT(99, 'finishing charge') })
  await session.advance(60_000)
  expect((await read(session))?.text).toBe('⚡ 99%')
})

test('battery-band: a low battery on battery power is red', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pmset', { stdout: BATT(12, 'discharging') })
  await session.turn({})
  expect((await read(session))?.color).toBe('red')
  session.setCommand('pmset', { stdout: BATT(12, 'charging') })
  await session.advance(60_000)
  expect((await read(session))?.color).toBeUndefined()
})

test('battery-band: it asks pmset by argv, with a timeout', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pmset', { stdout: BATT(50, 'discharging') })
  await session.turn({})
  expect(session.calls('pmset')).toEqual([['pmset', '-g', 'batt']])
  expect(session.timeouts('pmset')).toEqual([5000])
})

test('battery-band: it runs at most once a minute', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pmset', { stdout: BATT(50, 'discharging') })
  await session.start()
  await session.settle()
  await session.turn({})
  await session.advance(30_000)
  // A turn end 30 s after a run does not ask again.
  await session.turn({})
  await session.bash('ls')
  expect(session.calls('pmset').length).toBe(1)
  await session.advance(29_000)
  expect(session.calls('pmset').length).toBe(1)
  await session.advance(1000)
  expect(session.calls('pmset').length).toBe(2)
  await session.turn({})
  expect(session.calls('pmset').length).toBe(2)
  await session.advance(60_000)
  expect(session.calls('pmset').length).toBe(3)
})

test('battery-band: a Mac with no battery, or another system, shows nothing', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pmset', { stdout: "Now drawing from 'AC Power'\n" })
  await session.turn({})
  expect(await read(session)).toBeUndefined()

  session.setCommand('pmset', 'reject')
  await session.advance(60_000)
  expect(await read(session)).toBeUndefined()

  session.setCommand('pmset', { exitCode: 1, stdout: BATT(50, 'discharging') })
  await session.advance(60_000)
  expect(await read(session)).toBeUndefined()
})

test('battery-band: a figure that cannot be read again is dropped, and logged once', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pmset', { stdout: BATT(50, 'discharging') })
  await session.turn({})
  expect((await read(session))?.text).toBe('🔋 50%')
  session.setCommand('pmset', 'reject')
  await session.advance(60_000)
  await session.advance(60_000)
  await session.advance(60_000)
  expect(await read(session)).toBeUndefined()
  expect(session.logs().filter(line => line.includes('battery-band')).length).toBe(1)
})

test('battery-band: a slow pmset never holds back a tool result or the turn end', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pmset', { stdout: BATT(50, 'discharging'), delayMs: 5000 })
  await session.turn({})
  // The clock stands still, so anything that waited for pmset would never answer.
  expect(await session.bash('ls')).toEqual({ result: {} })
  expect(await read(session)).toBeUndefined()
  await session.advance(5000)
  expect((await read(session))?.text).toBe('🔋 50%')
})

test('battery-band: drawing never writes state', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pmset', { stdout: BATT(50, 'discharging') })
  await session.turn({})
  const before = session.stateWrites('fetched')
  await read(session)
  await read(session, 'desktop')
  expect(session.stateWrites('fetched')).toBe(before)
})
