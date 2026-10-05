import type { ModelCompleteRequest, ModelCompleteResult, PluginOptions, ProcessRunResult, ToolCallEnvelope, ToolCallResult } from 'claude-code'

// What a nudge may read when the turn stops. The engine forbids passing `$`
// itself, so it hands over these functions instead.
export type NudgeTools = {
  contextPercent: () => Promise<number | undefined>
  // The host clock and the session start, both in milliseconds since the epoch.
  now: () => Promise<number>
  sessionStartedAt: () => Promise<number>
  // The variable NAMES listed in `.env.example` (never values, never `.env`),
  // or undefined when the project has no `.env.example`.
  envExampleNames: () => Promise<readonly string[] | undefined>
  // One model call. It resolves with `isAnswered: false` instead of throwing
  // when the model gives no text, so a nudge checks that before it speaks.
  complete: (request: ModelCompleteRequest) => Promise<ModelCompleteResult>
  // Runs a program (argv only, no shell) in `cwd`, with a time limit. It
  // rejects when the program is missing or runs too long.
  run: (argv: readonly string[], cwd: string) => Promise<ProcessRunResult>
}

export const RUN_TIMEOUT_MS = 10_000

// One nudge: it may watch each tool call once the tool answered, and when
// the turn stops it may name a one-line reminder for the person. The engine
// shows each reminder as a toast; the model never reads it. `options` are the
// plugin's userConfig values, empty for a mod that declares none. `cwd` is
// the session cwd ('' when the host gave none), for `repoPath`.
export type Nudge = {
  id: string
  observe?: (e: ToolCallEnvelope, ran: ToolCallResult, cwd: string) => void
  atStop: (tools: NudgeTools, options: PluginOptions) => string | undefined | Promise<string | undefined>
}

export const ENV_EXAMPLE = '.env.example'

// Keeps only the NAME of each `NAME=value` line; the value is dropped here.
export const envNames = (text: string): string[] =>
  text.split('\n').flatMap(line => {
    const name = /^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/.exec(line)?.[1]
    return name === undefined ? [] : [name]
  })

const failed = (id: string, error: unknown): string =>
  `${id}: skipped, ${error instanceof Error ? error.message : String(error)}`

// The tools a host does not give. A nudge that calls one is logged and
// skipped, and its tests fail: name what it uses in engine.json `needs`.
const absent = (name: string) => (): Promise<never> =>
  Promise.reject(new Error(`${name} is not given to this mod; name it in engine.json needs`))

export const NO_TOOLS: NudgeTools = {
  contextPercent: absent('contextPercent'),
  now: absent('now'),
  sessionStartedAt: absent('sessionStartedAt'),
  envExampleNames: absent('envExampleNames'),
  complete: absent('complete'),
  run: absent('run'),
}

// Hands each finished tool call to the nudges that watch them. `log` closes
// over the hook's `$`.
export const observeAll = async (
  nudges: readonly Nudge[],
  e: ToolCallEnvelope,
  ran: ToolCallResult,
  cwd: string,
  log: (text: string) => unknown,
): Promise<void> => {
  for (const nudge of nudges) {
    try {
      nudge.observe?.(e, ran, cwd)
    } catch (error) {
      await log(failed(nudge.id, error))
    }
  }
}

// Asks each nudge for its reminder as the turn stops and shows it as a toast.
// `toast` and `log` close over the hook's `$`.
export const remindAll = async (
  nudges: readonly Nudge[],
  tools: NudgeTools,
  options: PluginOptions,
  toast: (text: string) => unknown,
  log: (text: string) => unknown,
): Promise<void> => {
  for (const nudge of nudges) {
    try {
      const reminder = await nudge.atStop(tools, options)
      if (reminder !== undefined) await toast(`${nudge.id}: ${reminder}`)
    } catch (error) {
      await log(failed(nudge.id, error))
    }
  }
}
