import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const read = async (
  session: ReturnType<typeof probe>,
  surface: (typeof SURFACES)[number],
): Promise<{ text: string; color: unknown } | undefined> => {
  const ui = await session.mount(surface)
  const segment = (await session.segments(ui)).find(item => item.key === 'context-meter')
  await ui.unmount()
  return segment === undefined ? undefined : { text: segment.text, color: segment.color }
}

test('context-meter: a 10 cell bar and the percent, on every surface', async ($, on) => {
  const session = probe($, on)
  await session.turn({ percent: 62 })
  for (const surface of SURFACES) expect((await read(session, surface))?.text).toBe('[######----] 62%')
})

test('context-meter: plain below 60, yellow from 60, red from 80', async ($, on) => {
  const session = probe($, on)
  const colors: [number, unknown][] = []
  for (const percent of [0, 59, 60, 79, 80, 100]) {
    await session.turn({ percent })
    colors.push([percent, (await read(session, 'terminal'))?.color])
  }
  expect(colors).toEqual([
    [0, undefined],
    [59, undefined],
    [60, 'yellow'],
    [79, 'yellow'],
    [80, 'red'],
    [100, 'red'],
  ])
})

test('context-meter: the bar edges, and a bar never reads full before 100', async ($, on) => {
  const session = probe($, on)
  const bars: string[] = []
  for (const percent of [0, 5, 99, 100]) {
    await session.turn({ percent })
    bars.push((await read(session, 'terminal'))?.text ?? 'missing')
  }
  expect(bars).toEqual(['[----------] 0%', '[----------] 5%', '[#########-] 99%', '[##########] 100%'])
})

test('context-meter: a fractional percent shows whole', async ($, on) => {
  const session = probe($, on)
  await session.turn({ percent: 61.6 })
  expect((await read(session, 'terminal'))?.text).toBe('[######----] 62%')
})

test('context-meter: hides when the percent is absent', async ($, on) => {
  const session = probe($, on)
  await session.turn({ usd: 1 })
  for (const surface of SURFACES) expect(await read(session, surface)).toBeUndefined()
})
