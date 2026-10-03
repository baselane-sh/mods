import { expect, test } from 'claude-code/testing'

import { compose, ENGINE_SECTIONS } from './probe'

test('plain-english: adds its section last, session scope, keeps the existing ones', async ($, on) => {
  const sections = await compose($, on)
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(sections.length).toBe(ENGINE_SECTIONS.length + 1)
  const last = sections[sections.length - 1]
  expect(last?.id).toBe('plain-english:style')
  expect(last?.scope).toBe('session')
})

test('plain-english: the section says what the rule asks', async ($, on) => {
  const text = (await compose($, on)).at(-1)?.text ?? ''
  for (const phrase of ['ASD-STE100', 'active voice', 'one instruction', 'short sentences']) expect(text).toContain(phrase)
})
