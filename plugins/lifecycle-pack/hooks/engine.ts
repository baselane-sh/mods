import type { PluginOptions, ProcessRunResult, ToolCallEnvelope, ToolCallResult } from 'claude-code'

// What each kind of rule may use. The engine forbids passing `$` itself, so
// it hands over these functions instead, one set per hook.
export type PushTools = {
  post: (url: string, headers: Record<string, string>, body: string) => Promise<void>
}

export type RunTools = {
  run: (argv: readonly string[]) => Promise<ProcessRunResult>
}

export type NotifyTools = PushTools & RunTools

export type ToolTools = PushTools & {
  cwd: () => Promise<string>
  root: () => Promise<string>
  exists: (path: string) => Promise<boolean>
  read: (path: string) => Promise<string>
  list: (path: string) => Promise<readonly string[]>
  run: (argv: readonly string[], cwd?: string) => Promise<ProcessRunResult>
}

export type JournalTools = {
  home: () => Promise<string | undefined>
  now: () => Promise<number>
  exists: (path: string) => Promise<boolean>
  read: (path: string) => Promise<string>
  write: (path: string, text: string) => Promise<void>
}

// The plugin's userConfig values, checked.
export type Settings = { ntfyTopic: string; longRunSecs: number; slackWebhookUrl: string; discordWebhookUrl: string }

export const DEFAULT_LONG_RUN_SECS = 60

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export const settingsFrom = (options: PluginOptions): Settings => {
  const secs = options['longRunSecs']
  return {
    ntfyTopic: text(options['ntfyTopic']),
    longRunSecs: typeof secs === 'number' && Number.isFinite(secs) && secs > 0 ? secs : DEFAULT_LONG_RUN_SECS,
    slackWebhookUrl: text(options['slackWebhookUrl']),
    discordWebhookUrl: text(options['discordWebhookUrl']),
  }
}

// A finished tool call, as the rules after a tool see it.
export type ToolRun = { e: ToolCallEnvelope; elapsedMs: number }

// A finished main-loop turn, as the rules at a turn's end see it.
export type TurnEnd = { cwd: string; durationMs: number; isAborted: boolean }

// One lifecycle rule. Each member is optional: a rule names what it does at
// the moments it cares about. `afterTool` may return a note the model reads
// with the tool's result; the others act on the outside world.
export type LifecycleRule = {
  id: string
  afterTool?: (run: ToolRun, tools: ToolTools, settings: Settings) => Promise<string | undefined>
  onNeedsInput?: (e: { cwd: string }, tools: NotifyTools, settings: Settings) => Promise<void>
  onTurnEnd?: (e: TurnEnd, tools: RunTools, settings: Settings) => Promise<void>
  onSessionEnd?: (e: { cwd: string; reason: string }, tools: JournalTools, settings: Settings) => Promise<void>
}

const PUSH_TIMEOUT_MS = 5000
// The Notification types that wait for the person. Others (auth_success and
// the like) need no input, so they send nothing.
const NEEDS_INPUT = new Set(['permission_prompt', 'idle_prompt', 'elicitation_dialog'])
// A desktop notification or a spoken line must not hold up the session long.
export const NOTIFY_TIMEOUT_MS = 10_000
export const RUN_TIMEOUT_MS = 30_000

type Log = (text: string) => unknown

const failed = (id: string, error: unknown): string =>
  `${id}: skipped, ${error instanceof Error ? error.message : String(error)}`

// A rule that throws is logged and skipped, never allowed to break the tool
// call or the shutdown.
const guarded = async (id: string, log: Log, work: () => Promise<void>): Promise<void> => {
  try {
    await work()
  } catch (error) {
    await log(failed(id, error))
  }
}

// The fetch has no timeout of its own, and a stuck push must not hold up the
// tool result. `fetch` and `sleep` are closures over the hook's `$`.
export const push = async (fetch: () => Promise<{ ok: boolean; status: number }>, sleep: (ms: number) => Promise<void>) => {
  const answer = await Promise.race([
    fetch(),
    sleep(PUSH_TIMEOUT_MS).then(() => {
      throw new Error('the push timed out')
    }),
  ])
  if (!answer.ok) throw new Error(`the push was refused (HTTP ${answer.status})`)
}

// The tools a host does not give. A rule that calls one is logged and
// skipped, and its tests fail: name what it uses in engine.json `needs`.
const absent = (name: string) => (): Promise<never> =>
  Promise.reject(new Error(`${name} is not given to this mod; name it in engine.json needs`))

export const NO_TOOL_TOOLS: ToolTools = {
  cwd: absent('cwd'),
  root: absent('root'),
  exists: absent('exists'),
  read: absent('read'),
  list: absent('list'),
  run: absent('run'),
  post: absent('post'),
}

export const NO_NOTIFY_TOOLS: NotifyTools = { post: absent('post'), run: absent('run') }

// After each tool call that ran (not denied, no error): each rule's
// `afterTool`, and the notes they return beside the result. `now` and `log`
// close over the hook's `$`.
export const afterTool = async (
  rules: readonly LifecycleRule[],
  settings: Settings,
  tools: ToolTools,
  host: { now: () => Promise<number>; log: Log },
  e: ToolCallEnvelope,
  next: (e: ToolCallEnvelope) => Promise<ToolCallResult>,
): Promise<ToolCallResult> => {
  const startedAt = await host.now()
  const ran = await next(e)
  if (ran.deny !== undefined || ran.isError !== undefined) return ran
  const elapsedMs = (await host.now()) - startedAt
  let notes: readonly string[] = []
  for (const rule of rules) {
    await guarded(rule.id, host.log, async () => {
      const note = await rule.afterTool?.({ e, elapsedMs }, tools, settings)
      if (note !== undefined) notes = [...notes, note]
    })
  }
  return notes.length === 0 ? ran : { ...ran, context: [...(ran.context ?? []), ...notes] }
}

// Only the Notification types that wait for the person reach the rules.
export const needsInput = async (
  rules: readonly LifecycleRule[],
  settings: Settings,
  tools: NotifyTools,
  log: Log,
  e: { cwd: string; notification_type: string },
): Promise<void> => {
  if (!NEEDS_INPUT.has(e.notification_type)) return
  for (const rule of rules) await guarded(rule.id, log, async () => rule.onNeedsInput?.(e, tools, settings))
}

export const turnEnd = async (rules: readonly LifecycleRule[], settings: Settings, tools: RunTools, log: Log, end: TurnEnd): Promise<void> => {
  for (const rule of rules) await guarded(rule.id, log, async () => rule.onTurnEnd?.(end, tools, settings))
}

export const sessionEnd = async (
  rules: readonly LifecycleRule[],
  settings: Settings,
  tools: JournalTools,
  log: Log,
  e: { cwd: string; reason: string },
): Promise<void> => {
  for (const rule of rules) await guarded(rule.id, log, async () => rule.onSessionEnd?.(e, tools, settings))
}
