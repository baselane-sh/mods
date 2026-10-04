import { expect, test } from 'claude-code/testing'

import { HOUR, NOON, SURFACES, probe } from './probe'

const FULL = { usd: 1.42, percent: 62, startedAt: NOON - HOUR, model: 'claude-opus-4-1' }

test('band: one row joins the segments with two spaces', async ($, on) => {
  const session = probe($, on, { usd: 1.34, percent: 50 })
  await session.wake()
  await session.turn(FULL)
  for (const surface of SURFACES) {
    const ui = await session.mount(surface)
    const segments = await session.segments(ui)
    expect(segments.length).toBeGreaterThan(0)
    expect((await ui.find({ key: 'band' }))?.text).toBe(segments.map(segment => segment.text).join('  '))
    await ui.unmount()
  }
})

test('band: the row fits the width, dropping whole segments from the right', async ($, on) => {
  const session = probe($, on, { usd: 1.34, percent: 50 })
  await session.wake()
  await session.turn(FULL)
  const wide = await session.mount('terminal', 200)
  const full = (await session.segments(wide)).map(segment => segment.text)
  await wide.unmount()

  for (const surface of SURFACES) {
    for (const columns of [120, 80, 40, 24, 12]) {
      const ui = await session.mount(surface, columns)
      const row = await ui.find({ key: 'band' })
      const shown = (await session.segments(ui)).map(segment => segment.text)
      expect({ surface, columns, fits: (row?.text.length ?? 0) <= columns }).toEqual({ surface, columns, fits: true })
      expect(shown).toEqual(full.slice(0, shown.length))
      await ui.unmount()
    }
  }
})

test('band: with no figures the engine draws its own', async ($, on) => {
  const session = probe($, on)
  await session.turn({})
  for (const surface of SURFACES) {
    const ui = await session.mount(surface)
    expect(await ui.find({ key: 'band' })).toBeUndefined()
    await ui.unmount()
  }
})

test('band: before the first turn ends there is nothing to show', async ($, on) => {
  const session = probe($, on, FULL)
  const ui = await session.mount('terminal')
  expect(await ui.find({ key: 'band' })).toBeUndefined()
  await ui.unmount()
})

test('band: it yields to a survey', async ($, on) => {
  const session = probe($, on, { usd: 1.34, percent: 50 })
  await session.turn(FULL)
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 80, true)
    expect(await ui.find({ key: 'band' })).toBeUndefined()
    await ui.unmount()
  }
})

test('band: a subagent turn does not move the figures', async ($, on) => {
  const session = probe($, on, { usd: 1.34, percent: 50 })
  await session.turn(FULL)
  const before = await session.mount('terminal')
  const shown = await session.segments(before)
  await before.unmount()

  await session.complete({ usd: 9, percent: 99 }, { agentId: 'agent-1' })
  const after = await session.mount('terminal')
  expect(await session.segments(after)).toEqual(shown)
  await after.unmount()
})

test('band: a usage read that fails is logged and the turn still ends', async ($, on) => {
  const session = probe($, on)
  session.breakUsage()
  await session.complete(FULL)
  expect(session.logs().length).toBeGreaterThan(0)
  const ui = await session.mount('terminal')
  expect(await ui.find({ key: 'band' })).toBeUndefined()
  await ui.unmount()
})
