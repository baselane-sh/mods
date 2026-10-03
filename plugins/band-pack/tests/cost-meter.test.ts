import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

test('cost-meter: shows the session cost and the last turn', async ($, on) => {
  const session = probe($, on, { usd: 1.34 })
  await session.turn({ usd: 1.42 })
  for (const surface of SURFACES) {
    const ui = await session.mount(surface)
    expect((await ui.find({ key: 'cost-meter' }))?.text).toBe('$1.42 +$0.08')
    await ui.unmount()
  }
})

test('cost-meter: the last turn is left out while it is unknown', async ($, on) => {
  const session = probe($, on)
  await session.complete({ usd: 1.42 })
  const first = await session.mount('terminal')
  expect((await first.find({ key: 'cost-meter' }))?.text).toBe('$1.42')
  await first.unmount()

  await session.complete({ usd: 1.5 })
  const second = await session.mount('terminal')
  expect((await second.find({ key: 'cost-meter' }))?.text).toBe('$1.50 +$0.08')
  await second.unmount()
})

test('cost-meter: the segment hides when the cost is absent, and never says n/a', async ($, on) => {
  const session = probe($, on)
  await session.turn({ percent: 40 })
  for (const surface of SURFACES) {
    const ui = await session.mount(surface)
    expect(await ui.find({ key: 'cost-meter' })).toBeUndefined()
    expect((await ui.findAll({ type: 'Text', text: /n\/a/ })).length).toBe(0)
    await ui.unmount()
  }
})

test('cost-meter: a cost that went down (a cleared session) shows no last turn', async ($, on) => {
  const session = probe($, on, { usd: 5 })
  await session.turn({ usd: 0.2 })
  const ui = await session.mount('terminal')
  expect((await ui.find({ key: 'cost-meter' }))?.text).toBe('$0.20')
  await ui.unmount()
})
