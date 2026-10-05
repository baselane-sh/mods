import { expect, test } from 'claude-code/testing'

import { rule } from '../hooks/rules/bead-chime'
import { probe } from './probe'

const CHIME = 'assets/bead-chime/chime.wav'
const played = (session: ReturnType<typeof probe>) => session.plays().map(play => play.asset)

test('bead-chime: names its one file', () => {
  expect(rule.clips).toEqual({ beadClosed: CHIME })
})

test('bead-chime: a close that ends with exit 0 chimes once', async ($, on) => {
  const session = probe($, on)
  await session.bash('bd close bm-1 bm-2 -r "shipped"')
  expect(played(session)).toEqual([CHIME])
})

test('bead-chime: bd done and a close inside a longer line chime', async ($, on) => {
  const session = probe($, on)
  await session.bash('bd done bm-1')
  await session.bash('cd /repo && bd -C /repo close bm-2')
  expect(played(session)).toEqual([CHIME, CHIME])
})

test('bead-chime: a close that failed is silent', async ($, on) => {
  const session = probe($, on)
  await session.bash('bd close bm-1', 'error')
  expect(played(session)).toEqual([])
})

test('bead-chime: a blocked close is silent', async ($, on) => {
  const session = probe($, on)
  await session.bash('bd close bm-1', 'deny')
  expect(played(session)).toEqual([])
})

test('bead-chime: text that only mentions a close is silent', async ($, on) => {
  const session = probe($, on)
  await session.bash('echo "bd close bm-1"')
  await session.bash('bd ready')
  await session.bash('bd close --help')
  expect(played(session)).toEqual([])
})

test('bead-chime: tests, denials and turn ends stay silent', async ($, on) => {
  const session = probe($, on)
  await session.bash('npm test')
  await session.bash('npm test', 'error')
  await session.bash('rm -rf /', 'deny')
  await session.turn()
  expect(played(session)).toEqual([])
})

test('bead-chime: a non-Bash tool is silent', async ($, on) => {
  const session = probe($, on)
  await $.tool.call({ tool: 'Read', file_path: '/bd close' })
  expect(played(session)).toEqual([])
})

test('bead-chime: volume is the playback gain, 0 is silence', { options: { volume: 0.5 } }, async ($, on) => {
  const session = probe($, on)
  await session.bash('bd close bm-1')
  expect(session.plays()).toEqual([{ asset: CHIME, gain: 0.5 }])
})

test('bead-chime: volume 0 plays nothing', { options: { volume: 0 } }, async ($, on) => {
  const session = probe($, on)
  await session.bash('bd close bm-1')
  expect(played(session)).toEqual([])
})

test('bead-chime: an audio failure is logged and the call goes on', async ($, on) => {
  const session = probe($, on, true)
  const ran = await session.bash('bd close bm-1')
  expect(ran.result).toBeDefined()
  expect(session.logs()).toHaveLength(1)
  expect(session.logs()[0]).toMatch(/^bead-chime: no sound, /)
})
