import { expect, test } from 'claude-code/testing'

import { rule } from '../hooks/rules/secret-output'
import { FAKE } from './fixtures'
import { probe } from './probe'

test('secret-output-guard: warns the model when output carries a credential', async ($, on) => {
  const guard = probe($, on, { output: `token=${FAKE.github}\n` })
  const ran = await guard.run('cat config.txt')
  const notes = (ran.context ?? []).join(' ')
  expect(notes).toContain('secret-output-guard')
  expect(notes).toContain('cat config.txt')
  expect(notes).not.toContain(FAKE.github)
})

test('secret-output-guard: plain output gets no note', async ($, on) => {
  const guard = probe($, on, { output: 'hello\n' })
  const ran = await guard.run('echo hello')
  expect(ran.context ?? []).toEqual([])
})

test('secret-output-guard: names a Read source and redacts a Bash one', () => {
  const read = rule.after?.({ tool: 'Read', tool_use_id: 't', file_path: '/app/config.ts' }, { result: '', text: FAKE.aws })
  expect(read).toContain('the file /app/config.ts')
  const bash = rule.after?.({ tool: 'Bash', tool_use_id: 't', command: `curl -H "x: ${FAKE.npm}" api` }, { result: '', text: FAKE.npm })
  expect(bash).toContain('[REDACTED]')
  expect(bash).not.toContain(FAKE.npm)
})
