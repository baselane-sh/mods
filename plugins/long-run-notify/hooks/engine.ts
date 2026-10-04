import type { On, PluginOptions, ProcessRunResult, ToolCallEnvelope } from 'claude-code'

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
const NOTIFY_TIMEOUT_MS = 10_000

const failed = (id: string, error: unknown): string =>
  `${id}: skipped, ${error instanceof Error ? error.message : String(error)}`

// A rule that throws is logged and skipped, never allowed to break the tool
// call or the shutdown.
const guarded = async (id: string, log: (text: string) => unknown, work: () => Promise<void>): Promise<void> => {
  try {
    await work()
  } catch (error) {
    await log(failed(id, error))
  }
}

// $.http.fetch has no timeout of its own, and a stuck push must not hold up
// the tool result. `fetch` and `sleep` are closures over the hook's `$`.
const push = async (fetch: () => Promise<{ ok: boolean; status: number }>, sleep: (ms: number) => Promise<void>) => {
  const answer = await Promise.race([
    fetch(),
    sleep(PUSH_TIMEOUT_MS).then(() => {
      throw new Error('the push timed out')
    }),
  ])
  if (!answer.ok) throw new Error(`the push was refused (HTTP ${answer.status})`)
}

export const registerLifecycle = (on: On, rules: readonly LifecycleRule[], options: PluginOptions): void => {
  const settings = settingsFrom(options)
  const has = (pick: (rule: LifecycleRule) => unknown) => rules.some(rule => pick(rule) !== undefined)

  if (has(rule => rule.afterTool)) {
    on('tool.call', async ($, e, next) => {
      const tools: ToolTools = {
        cwd: () => $.session.cwd(),
        root: () => $.session.root(),
        exists: path => $.fs.exists(path),
        read: path => $.fs.read(path),
        list: async path => (await $.fs.list(path)).map(entry => entry.name),
        run: (argv, cwd) => $.process.run(argv, cwd === undefined ? { timeoutMs: 30_000 } : { cwd, timeoutMs: 30_000 }),
        post: (url, headers, body) =>
          push(
            () => $.http.fetch(url, { method: 'POST', headers, body }),
            ms => $.clock.sleep(ms),
          ),
      }
      const log = (text: string) => $.ui.log(text)
      const startedAt = await $.clock.now()
      const ran = await next(e)
      if (ran.deny !== undefined || ran.isError !== undefined) return ran
      const elapsedMs = (await $.clock.now()) - startedAt
      let notes: readonly string[] = []
      for (const rule of rules) {
        await guarded(rule.id, log, async () => {
          const note = await rule.afterTool?.({ e, elapsedMs }, tools, settings)
          if (note !== undefined) notes = [...notes, note]
        })
      }
      return notes.length === 0 ? ran : { ...ran, context: [...(ran.context ?? []), ...notes] }
    })
  }

  if (has(rule => rule.onNeedsInput)) {
    on('classic.Notification', async ($, e, next) => {
      if (!NEEDS_INPUT.has(e.notification_type)) return next(e)
      const tools: NotifyTools = {
        post: (url, headers, body) =>
          push(
            () => $.http.fetch(url, { method: 'POST', headers, body }),
            ms => $.clock.sleep(ms),
          ),
        run: argv => $.process.run(argv, { timeoutMs: NOTIFY_TIMEOUT_MS }),
      }
      const log = (text: string) => $.ui.log(text)
      for (const rule of rules) await guarded(rule.id, log, async () => rule.onNeedsInput?.(e, tools, settings))
      return next(e)
    })
  }

  // A subagent's turn is not the person's turn. The answer is shown first.
  if (has(rule => rule.onTurnEnd)) {
    on('turn.complete', async ($, e, next) => {
      const done = await next(e)
      if (e.agentId !== undefined) return done
      const tools: RunTools = { run: argv => $.process.run(argv, { timeoutMs: NOTIFY_TIMEOUT_MS }) }
      const log = (text: string) => $.ui.log(text)
      const end: TurnEnd = { cwd: await $.session.cwd(), durationMs: e.durationMs, isAborted: e.isAborted }
      for (const rule of rules) await guarded(rule.id, log, async () => rule.onTurnEnd?.(end, tools, settings))
      return done
    })
  }

  if (has(rule => rule.onSessionEnd)) {
    on('classic.SessionEnd', async ($, e, next) => {
      const tools: JournalTools = {
        home: () => $.env.get('HOME'),
        now: () => $.clock.now(),
        exists: path => $.fs.exists(path),
        read: path => $.fs.read(path),
        write: (path, text) => $.fs.write(path, text),
      }
      const log = (text: string) => $.ui.log(text)
      for (const rule of rules) await guarded(rule.id, log, async () => rule.onSessionEnd?.(e, tools, settings))
      return next(e)
    })
  }
}
