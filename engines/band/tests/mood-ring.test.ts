import { expect, test } from 'claude-code/testing'

import { DENY_WORD, FAIL_WORD, SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface)
  const found = (await session.segments(ui)).find(item => item.key === 'mood-ring')
  await ui.unmount()
  return found === undefined ? undefined : { text: found.text, color: found.color }
}

const calls = async (session: ReturnType<typeof probe>, good: number, bad: readonly string[] = []) => {
  for (let i = 0; i < good; i += 1) await session.bash('ls')
  for (const word of bad) await session.bash(`echo ${word}`)
}

test('mood-ring: hidden before the first tool call', async ($, on) => {
  const session = probe($, on)
  for (const surface of SURFACES) expect(await read(session, surface)).toBeUndefined()
})

test('mood-ring: all clean calls read calm and green, on every surface', async ($, on) => {
  const session = probe($, on)
  await calls(session, 20)
  for (const surface of SURFACES) expect(await read(session, surface)).toEqual({ text: '● calm', color: 'green' })
})

test('mood-ring: under 10 percent is calm, from 10 tense and yellow, from 30 stormy and red', async ($, on) => {
  const session = probe($, on)
  await calls(session, 20)
  // Each failure pushes one clean call out of the window of 20.
  const seen: [number, unknown, unknown][] = []
  for (let failures = 1; failures <= 6; failures += 1) {
    await session.bash(`echo ${FAIL_WORD}`)
    const mood = await read(session)
    seen.push([failures, mood?.text, mood?.color])
  }
  expect(seen).toEqual([
    [1, '\u25cf calm', 'green'],
    [2, '\u25cf tense', 'yellow'],
    [3, '\u25cf tense', 'yellow'],
    [4, '\u25cf tense', 'yellow'],
    [5, '\u25cf tense', 'yellow'],
    [6, '\u25cf stormy', 'red'],
  ])
})

test('mood-ring: a blocked call counts like an error', async ($, on) => {
  const session = probe($, on)
  await calls(session, 17, [DENY_WORD, DENY_WORD, DENY_WORD])
  expect((await read(session))?.text).toBe('● tense')
})

test('mood-ring: only the last 20 calls count', async ($, on) => {
  const session = probe($, on)
  await calls(session, 0, Array.from({ length: 20 }, () => FAIL_WORD))
  expect((await read(session))?.text).toBe('● stormy')
  await calls(session, 20)
  expect((await read(session))?.text).toBe('● calm')
})

test('mood-ring: a short history uses the calls so far', async ($, on) => {
  const session = probe($, on)
  await calls(session, 1, [FAIL_WORD])
  expect((await read(session))?.text).toBe('● stormy')
})

test('mood-ring: it leaves the tool result as it was', async ($, on) => {
  const session = probe($, on)
  expect(await session.bash(`echo ${DENY_WORD}`)).toEqual({ deny: 'blocked by test' })
  expect(await session.bash(`echo ${FAIL_WORD}`)).toMatchObject({ isError: true })
})

test('mood-ring: a turn end does not wipe it', async ($, on) => {
  const session = probe($, on)
  await calls(session, 3)
  await session.turn({ usd: 1, percent: 10 })
  expect((await read(session))?.text).toBe('● calm')
})
