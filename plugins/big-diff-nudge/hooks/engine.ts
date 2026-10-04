import type { ModelCompleteRequest, ModelCompleteResult, On, PluginOptions, ToolCallEnvelope, ToolCallResult } from 'claude-code'

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
}

// One nudge: it may watch each tool call once the tool answered, and when
// the turn stops it may name a one-line reminder for the person. The engine
// shows each reminder as a toast; the model never reads it. `options` are the
// plugin's userConfig values, empty for a mod that declares none.
export type Nudge = {
  id: string
  observe?: (e: ToolCallEnvelope, ran: ToolCallResult) => void
  atStop: (tools: NudgeTools, options: PluginOptions) => string | undefined | Promise<string | undefined>
}

const ENV_EXAMPLE = '.env.example'

// Keeps only the NAME of each `NAME=value` line; the value is dropped here.
export const envNames = (text: string): string[] =>
  text.split('\n').flatMap(line => {
    const name = /^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/.exec(line)?.[1]
    return name === undefined ? [] : [name]
  })

const failed = (id: string, error: unknown): string =>
  `${id}: skipped, ${error instanceof Error ? error.message : String(error)}`

export const registerNudges = (on: On, nudges: readonly Nudge[], options: PluginOptions = {}): void => {
  if (nudges.some(nudge => nudge.observe !== undefined)) {
    on('tool.call', async ($, e, next) => {
      const ran = await next(e)
      for (const nudge of nudges) {
        try {
          nudge.observe?.(e, ran)
        } catch (error) {
          await $.ui.log(failed(nudge.id, error))
        }
      }
      return ran
    })
  }

  on('classic.Stop', async ($, e, next) => {
    const tools: NudgeTools = {
      contextPercent: async () => (await $.session.usage()).context.percent,
      now: () => $.clock.now(),
      sessionStartedAt: async () => (await $.session.usage()).startedAt,
      envExampleNames: async () => ((await $.fs.exists(ENV_EXAMPLE)) ? envNames(await $.fs.read(ENV_EXAMPLE)) : undefined),
      complete: request => $.model.complete(request),
    }
    for (const nudge of nudges) {
      try {
        const reminder = await nudge.atStop(tools, options)
        if (reminder !== undefined) await $.ui.toast(`${nudge.id}: ${reminder}`)
      } catch (error) {
        await $.ui.log(failed(nudge.id, error))
      }
    }
    return next(e)
  })
}
