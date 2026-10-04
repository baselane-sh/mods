import { expect, test } from 'claude-code/testing'

import { PERIOD_MS } from '../hooks/rules/break-nudge'
import { probe } from './probe'

const MIN = 60_000
const NUDGE = (minutes: number) => `break-nudge: This session has run ${minutes} minutes. Take a short break.`

test('break-nudge: period is 90 minutes', () => {
  expect(PERIOD_MS).toBe(90 * MIN)
})

test('break-nudge: quiet before 90 minutes', async ($, on) => {
  const session = probe($, on)
  session.setNow(89 * MIN)
  expect(await session.stop()).toEqual([])
})

test('break-nudge: one toast at 90 minutes, none on the next turn', async ($, on) => {
  const session = probe($, on)
  session.setNow(90 * MIN)
  expect(await session.stop()).toEqual([NUDGE(90)])
  session.setNow(120 * MIN)
  expect(await session.stop()).toEqual([])
})

test('break-nudge: again every 90 minutes', async ($, on) => {
  const session = probe($, on)
  session.setNow(95 * MIN)
  await session.stop()
  session.setNow(179 * MIN)
  expect(await session.stop()).toEqual([])
  session.setNow(180 * MIN)
  expect(await session.stop()).toEqual([NUDGE(180)])
})

test('break-nudge: a long gap gives one toast, not one per missed period', async ($, on) => {
  const session = probe($, on)
  session.setNow(300 * MIN)
  expect(await session.stop()).toEqual([NUDGE(270)])
  expect(await session.stop()).toEqual([])
})
