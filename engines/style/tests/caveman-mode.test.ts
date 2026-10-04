import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('caveman-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'caveman-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('caveman-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'caveman-mode')).text).not.toContain('—')
})

test('caveman-mode: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'caveman-mode')
  for (const phrase of ['caveman', 'Short sentences', 'Fix bug. Test pass.']) expect(text).toContain(phrase)
})

test('caveman-mode: code, commands, commit messages and errors stay exact', async ($, on) => {
  const { text } = await ourSection($, on, 'caveman-mode')
  for (const phrase of ['Never use caveman speech inside code', 'shell commands', 'file contents', 'commit messages', 'error text']) {
    expect(text).toContain(phrase)
  }
})

test('caveman-mode: the answer stays accurate', async ($, on) => {
  expect((await ourSection($, on, 'caveman-mode')).text).toMatch(/stay accurate/)
})
