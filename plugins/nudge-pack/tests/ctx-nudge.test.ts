import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

test('ctx-nudge: reminds at or above 75 percent', async ($, on) => {
  const session = probe($, on, 75)
  expect(await session.stop()).toContain('ctx-nudge: Context 75%. Consider /clear for a new task or /compact to keep going.')
})

test('ctx-nudge: quiet below the threshold', async ($, on) => {
  const session = probe($, on, 74)
  expect((await session.stop()).filter(text => text.startsWith('ctx-nudge'))).toEqual([])
})
