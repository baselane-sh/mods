import { expect, test } from 'claude-code/testing'

import { compose } from './probe'

test('style engine: shared sections stay ahead of session ones', async ($, on) => {
  const sections = await compose($, on)
  const firstSession = sections.findIndex(section => section.scope === 'session')
  expect(sections.slice(firstSession).every(section => section.scope === 'session')).toBe(true)
})
