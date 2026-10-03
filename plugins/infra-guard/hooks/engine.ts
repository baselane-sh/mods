import type { On, PreToolUseResult, ToolCallEnvelope } from 'claude-code'

// One guard rule: a check over a tool call that names a reason when the call
// is risky. The engine asks the person (or refuses, for a deny rule) with
// every reason that fired.
export type GuardRule = {
  id: string
  decision: 'ask' | 'deny'
  check: (e: ToolCallEnvelope) => string | undefined
}

type Hit = { id: string; decision: GuardRule['decision']; reason: string }

// A rule that throws fails closed: the person is asked rather than the call
// passing unchecked.
const run = (rule: GuardRule, e: ToolCallEnvelope): Hit | undefined => {
  try {
    const reason = rule.check(e)
    return reason === undefined ? undefined : { id: rule.id, decision: rule.decision, reason }
  } catch {
    return { id: rule.id, decision: 'ask', reason: 'the check failed, so this call was not inspected.' }
  }
}

export const evaluate = (
  rules: readonly GuardRule[],
  e: ToolCallEnvelope,
): PreToolUseResult | undefined => {
  const hits = rules.map(rule => run(rule, e)).filter((hit): hit is Hit => hit !== undefined)

  if (hits.length === 0) {
    return undefined
  }

  const text = `${hits.map(hit => `${hit.id}: ${hit.reason}`).join(' ')} Confirm this is intended.`

  return hits.some(hit => hit.decision === 'deny') ? { deny: text } : { ask: text }
}

export const registerGuards = (on: On, rules: readonly GuardRule[]): void => {
  on('classic.PreToolUse', ($, e, next) => evaluate(rules, e) ?? next(e))
}
