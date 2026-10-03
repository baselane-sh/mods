import type { On, ToolCallEnvelope } from 'claude-code'

// What a nudge may read when the turn stops. The engine forbids passing `$`
// itself, so it hands over these functions instead.
export type NudgeTools = {
  contextPercent: () => Promise<number | undefined>
}

// One nudge: it may watch each tool call once the tool answered, and when
// the turn stops it may name a one-line reminder for the person. The engine
// shows each reminder as a toast; the model never reads it.
export type Nudge = {
  id: string
  observe?: (e: ToolCallEnvelope) => void
  atStop: (tools: NudgeTools) => string | undefined | Promise<string | undefined>
}

const failed = (id: string, error: unknown): string =>
  `${id}: skipped, ${error instanceof Error ? error.message : String(error)}`

export const registerNudges = (on: On, nudges: readonly Nudge[]): void => {
  if (nudges.some(nudge => nudge.observe !== undefined)) {
    on('tool.call', async ($, e, next) => {
      const ran = await next(e)
      for (const nudge of nudges) {
        try {
          nudge.observe?.(e)
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
    }
    for (const nudge of nudges) {
      try {
        const reminder = await nudge.atStop(tools)
        if (reminder !== undefined) await $.ui.toast(`${nudge.id}: ${reminder}`)
      } catch (error) {
        await $.ui.log(failed(nudge.id, error))
      }
    }
    return next(e)
  })
}
