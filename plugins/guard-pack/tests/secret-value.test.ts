import { expect, test } from 'claude-code/testing'

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
