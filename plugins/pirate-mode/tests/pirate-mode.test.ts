import { expect, test } from 'claude-code/testing'

import { compose, ENGINE_SECTIONS } from './probe'

test('pirate-mode: adds its section last, session scope, keeps the existing ones', async ($, on) => {
  const sections = await compose($, on)
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(sections.length).toBe(ENGINE_SECTIONS.length + 1)
  const last = sections[sections.length - 1]
  expect(last?.id).toBe('pirate-mode:style')
  expect(last?.scope).toBe('session')
})

test('pirate-mode: the section says what the rule asks', async ($, on) => {
  const text = (await compose($, on)).at(-1)?.text ?? ''
  for (const phrase of ['pirate', 'Never use pirate speech inside code', 'shell commands', 'file contents']) expect(text).toContain(phrase)
})
