import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('bullet-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'bullet-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('bullet-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'bullet-mode')).text).not.toContain('\u2014')
})

test('bullet-mode: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'bullet-mode')
  for (const phrase of ['short bullet list', 'at most one sentence per bullet', 'no long paragraphs', 'asks for code', 'complete code']) expect(text).toContain(phrase)
})

test('bullet-mode: code, commands, commit messages and errors stay exact', async ($, on) => {
  const lower = (await ourSection($, on, 'bullet-mode')).text.toLowerCase()
  for (const phrase of ['code blocks', 'inline code', 'shell commands', 'file contents', 'commit messages', 'error text']) expect(lower).toContain(phrase)
  expect(lower).toContain('stay exact')
})

test('bullet-mode: does not set the commit message form', async ($, on) => {
  expect((await ourSection($, on, 'bullet-mode')).text).not.toContain('type(scope): subject')
})

test('bullet-mode: facts stay accurate', async ($, on) => {
  expect((await ourSection($, on, 'bullet-mode')).text).toMatch(/Facts stay accurate/)
})
