import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('noir-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'noir-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('noir-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'noir-mode')).text).not.toContain('\u2014')
})

test('noir-mode: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'noir-mode')
  for (const phrase of ['hard-boiled detective narrator', 'dry', 'stays clear', 'a line or two']) expect(text).toContain(phrase)
})

test('noir-mode: code, commands, commit messages and errors stay exact', async ($, on) => {
  const { text } = await ourSection($, on, 'noir-mode')
  for (const phrase of ['Never use noir speech inside code', 'shell commands', 'file contents', 'commit messages', 'error text']) expect(text).toContain(phrase)
})

test('noir-mode: does not set the commit message form', async ($, on) => {
  expect((await ourSection($, on, 'noir-mode')).text).not.toContain('type(scope): subject')
})

test('noir-mode: facts stay accurate', async ($, on) => {
  expect((await ourSection($, on, 'noir-mode')).text).toMatch(/Facts and instructions stay accurate/)
})
