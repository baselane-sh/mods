import type { PreToolUseResult, ProcessRunResult, ToolCallEnvelope, ToolCallResult } from 'claude-code'

// What a rule may use beyond the call itself: the session's directory, a
// host command (git, for the rules that inspect the repo) and where a path
// really lands.
export type GuardTools = {
  cwd: () => Promise<string>
  // The absolute path with every symbolic link followed, or undefined when
  // the path does not exist.
  realPath: (path: string) => Promise<string | undefined>
  run: (argv: readonly string[], cwd: string) => Promise<ProcessRunResult>
}

// One guard rule. `check` runs before the call and names a reason when the
// call is risky; the engine asks the person (or refuses, for a deny rule)
// with every reason that fired. `after` runs once the tool answered and
// names a note the model reads with the result. `prompt` reads the person's
// prompt text and names a note the model reads beside it.
export type GuardRule = {
  id: string
  decision: 'ask' | 'deny'
  check: (e: ToolCallEnvelope, tools: GuardTools) => string | undefined | Promise<string | undefined>
  after?: (e: ToolCallEnvelope, ran: ToolCallResult) => string | undefined
  prompt?: (text: string) => string | undefined
}

type Hit = { id: string; decision: GuardRule['decision']; reason: string }

export const RUN_TIMEOUT_MS = 10_000

// A rule that throws fails closed: the person is asked rather than the call
// passing unchecked.
const run = async (rule: GuardRule, e: ToolCallEnvelope, tools: GuardTools): Promise<Hit | undefined> => {
  try {
    const reason = await rule.check(e, tools)
    return reason === undefined ? undefined : { id: rule.id, decision: rule.decision, reason }
  } catch {
    return { id: rule.id, decision: 'ask', reason: 'the check failed, so this call was not inspected.' }
  }
}

export const evaluate = async (
  rules: readonly GuardRule[],
  e: ToolCallEnvelope,
  tools: GuardTools,
): Promise<PreToolUseResult | undefined> => {
  const hits = (await Promise.all(rules.map(rule => run(rule, e, tools)))).filter(
    (hit): hit is Hit => hit !== undefined,
  )

  if (hits.length === 0) {
    return undefined
  }

  const text = `${hits.map(hit => `${hit.id}: ${hit.reason}`).join(' ')} Confirm this is intended.`

  return hits.some(hit => hit.decision === 'deny') ? { deny: text } : { ask: text }
}

// A note that fails to compute is dropped: the tool already ran, so there is
// nothing left to gate.
export const notesFor = (rules: readonly GuardRule[], e: ToolCallEnvelope, ran: ToolCallResult): string[] =>
  rules.flatMap(rule => {
    try {
      const note = rule.after?.(e, ran)
      return note === undefined ? [] : [`SECURITY (${rule.id}): ${note}`]
    } catch {
      return []
    }
  })

// Same drop-on-failure rule as notesFor: a prompt is never held back by a
// check that threw.
export const promptNotesFor = (rules: readonly GuardRule[], text: string): string[] =>
  rules.flatMap(rule => {
    try {
      const note = rule.prompt?.(text)
      return note === undefined ? [] : [`SECURITY (${rule.id}): ${note}`]
    } catch {
      return []
    }
  })

// The tools a host does not give. A rule that calls one fails closed with an
// ask (see `run`), and its tests fail: name what it uses in engine.json `needs`.
const absent = (name: string) => (): Promise<never> =>
  Promise.reject(new Error(`${name} is not given to this mod; name it in engine.json needs`))

export const NO_TOOLS: GuardTools = { cwd: absent('cwd'), realPath: absent('realPath'), run: absent('run') }
