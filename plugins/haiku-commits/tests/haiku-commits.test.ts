import { expect, test } from 'claude-code/testing'

import { compose, ENGINE_SECTIONS } from './probe'

const textOf = async (...args: Parameters<typeof compose> extends [infer A, infer B, ...unknown[]] ? [A, B] : never) =>
  (await compose(...args)).at(-1)?.text ?? ''

test('haiku-commits: adds its section last, session scope, keeps the existing ones', async ($, on) => {
  const sections = await compose($, on)
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(sections.length).toBe(ENGINE_SECTIONS.length + 1)
  const last = sections[sections.length - 1]
  expect(last?.id).toBe('haiku-commits:style')
  expect(last?.scope).toBe('session')
})

test('haiku-commits: the section asks for a conventional first line and a 5-7-5 haiku', async ($, on) => {
  const text = await textOf($, on)
  for (const phrase of ['commit message', 'Conventional Commits', 'type(scope): subject', 'blank line', 'haiku', '5-7-5', 'five', 'seven']) {
    expect(text).toContain(phrase)
  }
})

test('haiku-commits: the conventional line comes first so tools still parse it', async ($, on) => {
  const text = await textOf($, on)
  expect(text.indexOf('type(scope): subject')).toBeGreaterThan(-1)
  expect(text.indexOf('type(scope): subject')).toBeLessThan(text.indexOf('blank line'))
  expect(text).toMatch(/first line/i)
  expect(text).toMatch(/never put the haiku (on|in) the first line/i)
})

test('haiku-commits: other writing stays normal', async ($, on) => {
  expect(await textOf($, on)).toMatch(/applies only to commit messages/i)
})

test('haiku-commits: no em-dash', async ($, on) => {
  expect(await textOf($, on)).not.toContain('\u2014')
})
