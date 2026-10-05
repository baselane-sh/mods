import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('docstring-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'docstring-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('docstring-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'docstring-mode')).text).not.toContain('\u2014')
})

test('docstring-mode: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'docstring-mode')
  for (const phrase of ['every new or changed public function', 'normal style of its language', 'Python docstring', 'one to three lines', 'Do not comment private helpers']) expect(text).toContain(phrase)
})

test('docstring-mode: code, commands, commit messages and errors stay exact', async ($, on) => {
  const lower = (await ourSection($, on, 'docstring-mode')).text.toLowerCase()
  for (const phrase of ['code blocks', 'inline code', 'shell commands', 'file contents', 'commit messages', 'error text']) expect(lower).toContain(phrase)
  expect(lower).toContain('stay exact')
})

test('docstring-mode: does not set the commit message form', async ($, on) => {
  expect((await ourSection($, on, 'docstring-mode')).text).not.toContain('type(scope): subject')
})

test('docstring-mode: never invents behaviour', async ($, on) => {
  expect((await ourSection($, on, 'docstring-mode')).text).toMatch(/never invent behaviour/)
})
