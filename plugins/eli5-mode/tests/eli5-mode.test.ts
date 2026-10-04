import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('eli5-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'eli5-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('eli5-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'eli5-mode')).text).not.toContain('—')
})

test('eli5-mode: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'eli5-mode')
  for (const phrase of ['new to the topic', 'analogy', 'one-line definition', 'jargon']) expect(text).toContain(phrase)
})

test('eli5-mode: code and exact text stay exact, facts stay accurate', async ($, on) => {
  const { text } = await ourSection($, on, 'eli5-mode')
  for (const phrase of ['Code, commands and error text stay exact', 'stay accurate']) expect(text).toContain(phrase)
})

