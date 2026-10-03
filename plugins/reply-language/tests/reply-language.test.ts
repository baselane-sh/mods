import { expect, test } from 'claude-code/testing'

import { compose, ENGINE_SECTIONS } from './probe'

test('reply-language: adds its section last, session scope, keeps the existing ones', async ($, on) => {
  const sections = await compose($, on)
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(sections.length).toBe(ENGINE_SECTIONS.length + 1)
  const last = sections[sections.length - 1]
  expect(last?.id).toBe('reply-language:style')
  expect(last?.scope).toBe('session')
})

test('reply-language: the default language is English', async ($, on) => {
  const text = (await compose($, on)).at(-1)?.text ?? ''
  expect(text).toContain('in English')
  expect(text).toContain('Keep code, identifiers')
})

test('reply-language: a configured language is used', { options: { language: 'Arabic' } }, async ($, on) => {
  const text = (await compose($, on)).at(-1)?.text ?? ''
  expect(text).toContain('in Arabic')
  expect(text).not.toContain('English')
})

test('reply-language: a blank language falls back to English', { options: { language: '   ' } }, async ($, on) => {
  const text = (await compose($, on)).at(-1)?.text ?? ''
  expect(text).toContain('in English')
})
