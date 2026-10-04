import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('security-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'security-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('security-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'security-mode')).text).not.toContain('\u2014')
})

test('security-mode: names the four risk classes', async ($, on) => {
  const { text } = await ourSection($, on, 'security-mode')
  for (const phrase of ['injection', 'secrets', 'authorization', 'input']) expect(text).toContain(phrase)
})

test('security-mode: the reply states the risks it checked', async ($, on) => {
  const { text } = await ourSection($, on, 'security-mode')
  expect(text).toContain('Security checked:')
  for (const phrase of ['ok', 'fixed', 'flagged']) expect(text).toContain(phrase)
  expect(text).toMatch(/never say a change is safe without that list/i)
})

test('security-mode: the checked line stays out of commit messages and code', async ($, on) => {
  expect((await ourSection($, on, 'security-mode')).text).toMatch(/never in a commit message or in code/i)
})
