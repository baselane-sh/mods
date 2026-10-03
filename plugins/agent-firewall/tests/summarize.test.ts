import { expect, test } from 'claude-code/testing'

import { rule } from '../hooks/rules/summarize'

test('summarize: names the part of the input that says what the call does', () => {
  expect(rule.summarize({ tool: 'Bash', tool_use_id: 't', command: 'npm test' })).toBe('npm test')
  expect(rule.summarize({ tool: 'Read', tool_use_id: 't', file_path: '/repo/a.ts' })).toBe('/repo/a.ts')
  expect(rule.summarize({ tool: 'Write', tool_use_id: 't', file_path: '/repo/b.ts', content: 'x' })).toBe('/repo/b.ts')
  expect(rule.summarize({ tool: 'Edit', tool_use_id: 't', file_path: '/repo/c.ts', old_string: 'a', new_string: 'b' })).toBe('/repo/c.ts')
  expect(rule.summarize({ tool: 'WebFetch', tool_use_id: 't', url: 'https://example.com', prompt: 'read it' })).toBe('https://example.com')
})

test('summarize: a tool it does not know is left to the engine', () => {
  expect(rule.summarize({ tool: 'mcp__notes__add', tool_use_id: 't', text: 'milk' })).toBeUndefined()
})
