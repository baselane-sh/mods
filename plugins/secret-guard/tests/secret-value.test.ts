import { expect, test } from 'claude-code/testing'

import { rule } from '../hooks/rules/secret-value'
import { FAKE } from './fixtures'
import { probe } from './probe'

test('secret-guard: every fake credential shape is caught in a Bash command', async ($, on) => {
  const guard = probe($, on)
  for (const [name, value] of Object.entries(FAKE)) {
    const command = `echo ${JSON.stringify(value)} > out.txt`
    expect({ name, answered: await guard.answered(command) }).toEqual({ name, answered: true })
  }
})

test('secret-guard: watches Write and Edit inputs', () => {
  expect(rule.check({ tool: 'Write', tool_use_id: 't', file_path: 'a.ts', content: `const k = "${FAKE.stripe}"` })).toBeDefined()
  expect(rule.check({ tool: 'Edit', tool_use_id: 't', file_path: 'a.ts', old_string: 'x', new_string: FAKE.github })).toBeDefined()
})

test('secret-guard: ordinary code passes', () => {
  expect(rule.check({ tool: 'Write', tool_use_id: 't', file_path: 'a.ts', content: 'const key = process.env.API_KEY' })).toBeUndefined()
  expect(rule.check({ tool: 'Bash', tool_use_id: 't', command: 'npm test' })).toBeUndefined()
})
