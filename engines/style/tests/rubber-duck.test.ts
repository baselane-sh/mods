import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('rubber-duck: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'rubber-duck')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('rubber-duck: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'rubber-duck')).text).not.toContain('\u2014')
})

test('rubber-duck: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'rubber-duck')
  for (const phrase of ['rubber duck', 'restate the problem in your own words', 'list your assumptions', 'then do the work', 'one line']) expect(text).toContain(phrase)
})

test('rubber-duck: code, commands, commit messages and errors stay exact', async ($, on) => {
  const lower = (await ourSection($, on, 'rubber-duck')).text.toLowerCase()
  for (const phrase of ['code blocks', 'inline code', 'shell commands', 'file contents', 'commit messages', 'error text']) expect(lower).toContain(phrase)
  expect(lower).toContain('stay exact')
})

test('rubber-duck: does not set the commit message form', async ($, on) => {
  expect((await ourSection($, on, 'rubber-duck')).text).not.toContain('type(scope): subject')
})

test('rubber-duck: asks about a risky assumption', async ($, on) => {
  expect((await ourSection($, on, 'rubber-duck')).text).toMatch(/risky/)
})
