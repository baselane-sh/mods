import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('gitmoji-commits: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'gitmoji-commits')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('gitmoji-commits: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'gitmoji-commits')).text).not.toContain('—')
})

test('gitmoji-commits: the section says what the rule asks', async ($, on) => {
  const { text } = await ourSection($, on, 'gitmoji-commits')
  for (const phrase of ['gitmoji', '✨ feat', '🐛 fix', '📝 docs', '♻️ refactor', '✅ test', 'commit message']) expect(text).toContain(phrase)
})

test('gitmoji-commits: composes with conventional-commits, emoji goes before the type', async ($, on) => {
  const { text } = await ourSection($, on, 'gitmoji-commits')
  expect(text).toMatch(/Conventional Commits/)
  expect(text).toMatch(/emoji first, then a space, then the type/i)
  expect(text).toMatch(/does not replace it/)
})

test('gitmoji-commits: does not own the type(scope) form, so a pack keeps one owner', async ($, on) => {
  expect((await ourSection($, on, 'gitmoji-commits')).text).not.toContain('type(scope): subject')
})

test('gitmoji-commits: applies only to commit messages', async ($, on) => {
  expect((await ourSection($, on, 'gitmoji-commits')).text).toMatch(/applies only to commit messages/i)
})

