import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('socratic-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'socratic-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('socratic-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'socratic-mode')).text).not.toContain('\u2014')
})

test('socratic-mode: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'socratic-mode')
  for (const phrase of ['Socratic', 'short hint', 'one guiding question', 'full answer when the person asks', 'is not a learning question']) expect(text).toContain(phrase)
})

test('socratic-mode: code, commands, commit messages and errors stay exact', async ($, on) => {
  const lower = (await ourSection($, on, 'socratic-mode')).text.toLowerCase()
  for (const phrase of ['code blocks', 'inline code', 'shell commands', 'file contents', 'commit messages', 'error text']) expect(lower).toContain(phrase)
  expect(lower).toContain('stay exact')
})

test('socratic-mode: does not set the commit message form', async ($, on) => {
  expect((await ourSection($, on, 'socratic-mode')).text).not.toContain('type(scope): subject')
})

test('socratic-mode: hints, never wrong facts', async ($, on) => {
  expect((await ourSection($, on, 'socratic-mode')).text).toMatch(/Facts stay accurate/)
})
