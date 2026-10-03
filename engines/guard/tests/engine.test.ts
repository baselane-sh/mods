import { expect, test } from 'claude-code/testing'

import { evaluate } from '../hooks/engine'
import type { GuardRule } from '../hooks/engine'
import { probe } from './probe'

const always = (id: string, decision: GuardRule['decision']): GuardRule => ({
  id,
  decision,
  check: () => 'always.',
})
const boom: GuardRule = {
  id: 'boom',
  decision: 'deny',
  check: () => {
    throw new Error('broken rule')
  },
}

test('engine: a plain command reaches the engine beneath', async ($, on) => {
  const guard = probe($, on)
  expect(await guard.answered('ls -la')).toBe(false)
})

test('engine: deny wins over ask and every reason is named', () => {
  const result = evaluate([always('a', 'ask'), always('b', 'deny')], { tool: 'Bash', tool_use_id: 't', command: 'x' })
  expect(result?.deny).toBe('a: always. b: always. Confirm this is intended.')
})

test('engine: a rule that throws fails closed with an ask', () => {
  const result = evaluate([boom], { tool: 'Bash', tool_use_id: 't', command: 'x' })
  expect(result?.ask).toBe('boom: the check failed, so this call was not inspected. Confirm this is intended.')
})

test('engine: no hit means no answer', () => {
  expect(evaluate([], { tool: 'Bash', tool_use_id: 't', command: 'x' })).toBeUndefined()
})
