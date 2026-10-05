import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('british-english: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'british-english')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('british-english: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'british-english')).text).not.toContain('\u2014')
})

test('british-english: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'british-english')
  for (const phrase of ['British spelling', 'colour', 'organise', 'licence as a noun', 'license as a verb']) expect(text).toContain(phrase)
})

test('british-english: code, commands, commit messages and errors stay exact', async ($, on) => {
  const { text } = await ourSection($, on, 'british-english')
  for (const phrase of ['Code identifiers', 'color: red', 'file contents', 'commit messages', 'error text']) expect(text).toContain(phrase)
})

test('british-english: does not set the commit message form', async ($, on) => {
  expect((await ourSection($, on, 'british-english')).text).not.toContain('type(scope): subject')
})
