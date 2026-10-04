import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

test('nudge engine: a stop with nothing to say raises no toast of its own', async ($, on) => {
  const session = probe($, on, 0)
  expect(await session.stop()).toEqual([])
})
