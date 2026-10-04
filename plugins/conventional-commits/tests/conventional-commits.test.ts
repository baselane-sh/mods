import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('conventional-commits: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'conventional-commits')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('conventional-commits: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'conventional-commits')).text).not.toContain('\u2014')
})

test('conventional-commits: asks for type(scope): subject, imperative, under 72 characters', async ($, on) => {
  const { text } = await ourSection($, on, 'conventional-commits')
  for (const phrase of ['commit message', 'type(scope): subject', 'imperative', '72 characters', 'feat', 'fix', 'BREAKING CHANGE']) {
    expect(text).toContain(phrase)
  }
})

test('conventional-commits: applies only to commit messages', async ($, on) => {
  expect((await ourSection($, on, 'conventional-commits')).text).toMatch(/applies only to commit messages/i)
})

test('conventional-commits: the body is optional and follows a blank line', async ($, on) => {
  expect((await ourSection($, on, 'conventional-commits')).text).toMatch(/body after a blank line only when/i)
})
