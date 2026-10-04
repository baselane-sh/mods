import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('tdd-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'tdd-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('tdd-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'tdd-mode')).text).not.toContain('\u2014')
})

test('tdd-mode: failing test first, then watch it fail, then implement', async ($, on) => {
  const { text } = await ourSection($, on, 'tdd-mode')
  const at = (phrase: string) => text.indexOf(phrase)
  for (const phrase of ['failing test', 'watch it fail', 'smallest change', 'refactor']) expect(at(phrase)).toBeGreaterThan(-1)
  expect(at('failing test')).toBeLessThan(at('watch it fail'))
  expect(at('watch it fail')).toBeLessThan(at('smallest change'))
})

test('tdd-mode: forbids production code first and unrun claims', async ($, on) => {
  const { text } = await ourSection($, on, 'tdd-mode')
  expect(text).toMatch(/never write production code first/i)
  expect(text).toMatch(/never claim a test passes without running it/i)
})

test('tdd-mode: governs the order of work, not reply or commit form', async ($, on) => {
  expect((await ourSection($, on, 'tdd-mode')).text).toMatch(/order of work only/i)
})
