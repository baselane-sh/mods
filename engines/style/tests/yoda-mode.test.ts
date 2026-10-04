import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('yoda-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'yoda-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('yoda-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'yoda-mode')).text).not.toContain('\u2014')
})

test('yoda-mode: speaks like Yoda in prose', async ($, on) => {
  const { text } = await ourSection($, on, 'yoda-mode')
  for (const phrase of ['Yoda', 'object-subject-verb']) expect(text).toContain(phrase)
})

test('yoda-mode: code, commands, commit messages and errors stay normal', async ($, on) => {
  const { text } = await ourSection($, on, 'yoda-mode')
  for (const phrase of ['Never use Yoda speech inside code', 'shell commands', 'file contents', 'commit messages', 'error text']) {
    expect(text).toContain(phrase)
  }
})

test('yoda-mode: the answer stays clear and accurate', async ($, on) => {
  const { text } = await ourSection($, on, 'yoda-mode')
  expect(text).toMatch(/stays clear/)
  expect(text).toMatch(/Facts and instructions stay accurate/)
})
