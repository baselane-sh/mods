import { expect, test } from 'claude-code/testing'

import { ENGINE_SECTIONS, ourSection } from './probe'

test('ste-mode: adds its section after the existing ones, session scope', async ($, on) => {
  const { sections, index, section } = await ourSection($, on, 'ste-mode')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBeGreaterThanOrEqual(ENGINE_SECTIONS.length)
  expect(section?.scope).toBe('session')
})

test('ste-mode: no em-dash', async ($, on) => {
  expect((await ourSection($, on, 'ste-mode')).text).not.toContain('\u2014')
})

test('ste-mode: names ASD-STE100 and its core limits', async ($, on) => {
  const { text } = await ourSection($, on, 'ste-mode')
  for (const phrase of ['ASD-STE100', 'approved words', '20 words or fewer', 'one instruction in each sentence', 'active voice']) {
    expect(text).toContain(phrase)
  }
})

test('ste-mode: code, commands and commit messages stay exact', async ($, on) => {
  const { text } = await ourSection($, on, 'ste-mode')
  expect(text).toMatch(/code, commands and commit messages exact/i)
  expect(text).toMatch(/prose replies only/i)
})
