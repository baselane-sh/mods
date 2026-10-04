import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { rule } from '../hooks/rules/secret-value'
import { FAKE, NO_TOOLS } from './fixtures'
import { probe } from './probe'

test('secret-guard: every fake credential shape is caught in a Bash command', async ($, on) => {
  const guard = probe($, on)
  for (const [name, value] of Object.entries(FAKE)) {
    const command = `echo ${JSON.stringify(value)} > out.txt`
    expect({ name, answered: await guard.answered(command) }).toEqual({ name, answered: true })
  }
})

test('secret-guard: watches Write and Edit inputs', async () => {
  expect(await rule.check({ tool: 'Write', tool_use_id: 't', file_path: 'a.ts', content: `const k = "${FAKE.stripe}"` }, NO_TOOLS)).toBeDefined()
  expect(await rule.check({ tool: 'Edit', tool_use_id: 't', file_path: 'a.ts', old_string: 'x', new_string: FAKE.github }, NO_TOOLS)).toBeDefined()
})

test('secret-guard: ordinary code passes', async () => {
  expect(await rule.check({ tool: 'Write', tool_use_id: 't', file_path: 'a.ts', content: 'const key = process.env.API_KEY' }, NO_TOOLS)).toBeUndefined()
  expect(await rule.check({ tool: 'Bash', tool_use_id: 't', command: 'npm test' }, NO_TOOLS)).toBeUndefined()
})

// The prompt path: the engine beneath answers with what the plugin handed it.
const submit = async ($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], text: string) => {
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  return $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
}

test('secret-guard: a prompt holding a credential gets a do-not-repeat note for the model', async ($, on) => {
  const ran = await submit($, on, `use this key: ${FAKE.github}`)
  const notes = (ran.context ?? []).join(' ')
  expect(notes).toContain('SECURITY (secret-guard)')
  expect(notes).toContain('Do NOT repeat, store, or commit')
  expect(notes).toContain('rotating')
  expect(notes).not.toContain(FAKE.github)
  expect(ran.text).toContain(FAKE.github)
})

test('secret-guard: an ordinary prompt gets no note', async ($, on) => {
  const ran = await submit($, on, 'please run the tests')
  expect(ran.context ?? []).toEqual([])
})

test('secret-guard: the prompt check names a credential and nothing else', () => {
  expect(rule.prompt?.(`k ${FAKE.stripe}`)).toContain('rotat')
  expect(rule.prompt?.('hello')).toBeUndefined()
})
