import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('shakespeare-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'shakespeare-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('shakespeare-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'shakespeare-mode')).text).not.toContain('—')
})

test('shakespeare-mode: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'shakespeare-mode')
  for (const phrase of ['Shakespeare', 'Early Modern English', 'thou']) expect(text).toContain(phrase)
})

test('shakespeare-mode: code, commands, commit messages and errors stay exact', async ($, on) => {
  const { text } = await ourSection($, on, 'shakespeare-mode')
  for (const phrase of ['Never use Shakespearean speech inside code', 'shell commands', 'file contents', 'commit messages', 'error text']) {
    expect(text).toContain(phrase)
  }
})

test('shakespeare-mode: the answer stays accurate', async ($, on) => {
  expect((await ourSection($, on, 'shakespeare-mode')).text).toMatch(/stay accurate/)
})
