import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('code-only: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'code-only')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('code-only: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'code-only')).text).not.toContain('—')
})

test('code-only: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'code-only')
  for (const phrase of ['code or the command first', 'two short sentences', 'unless the person asks']) expect(text).toContain(phrase)
})

test('code-only: asks to explain lifts the limit, and the code stays complete', async ($, on) => {
  const { text } = await ourSection($, on, 'code-only')
  expect(text).toMatch(/asks you to explain/)
  expect(text).toMatch(/complete/)
})

