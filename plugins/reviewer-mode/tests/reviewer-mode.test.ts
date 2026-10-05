import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('reviewer-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'reviewer-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('reviewer-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'reviewer-mode')).text).not.toContain('\u2014')
})

test('reviewer-mode: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'reviewer-mode')
  for (const phrase of ['strict senior reviewer', 'own diff', 'edge cases', 'issue you found and fixed', 'Review: no issues found']) expect(text).toContain(phrase)
})

test('reviewer-mode: code, commands, commit messages and errors stay exact', async ($, on) => {
  const lower = (await ourSection($, on, 'reviewer-mode')).text.toLowerCase()
  for (const phrase of ['code blocks', 'inline code', 'shell commands', 'file contents', 'commit messages', 'error text']) expect(lower).toContain(phrase)
  expect(lower).toContain('stay exact')
})

test('reviewer-mode: does not set the commit message form', async ($, on) => {
  expect((await ourSection($, on, 'reviewer-mode')).text).not.toContain('type(scope): subject')
})

test('reviewer-mode: never claims an unfixed issue', async ($, on) => {
  expect((await ourSection($, on, 'reviewer-mode')).text).toMatch(/Never list an issue as fixed unless you fixed it/)
})
