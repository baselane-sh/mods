import type { ToolCallEnvelope, ToolCallResult } from 'claude-code'

import type { Nudge } from '../engine'

// Off unless the person turns it on: each narrated turn is one model call.
export const MODEL = 'haiku'
const MAX_CALLS = 40
const MAX_LINE = 200

type Call = { label: string; failed: boolean }

const baseName = (path: string): string => path.split('/').at(-1) ?? path

// What a call is called to the model: a tool and, at most, a file name or the
// first two words of a command. Arguments and contents never leave the machine.
const labelOf = (e: ToolCallEnvelope): string => {
  if ('file_path' in e && typeof e.file_path === 'string') return `${e.tool} ${baseName(e.file_path)}`
  if (e.tool === 'Bash') return `Bash ${e.command.trim().split(/\s+/).slice(0, 2).join(' ')}`
  return e.tool
}

const SYSTEM =
  'You are a sports commentator doing live play-by-play of a coding assistant named Claude. Reply with exactly one line of at most 20 words, in the present tense, naming Claude. Use plain ASCII punctuation, no quotes, no emoji.'

const promptFor = (calls: readonly Call[]): string =>
  `This turn Claude did, in order:\n${calls.map((call, i) => `${i + 1}. ${call.label}${call.failed ? ' (failed)' : ''}`).join('\n')}\nCommentate.`

// The first line, without quotes or the em-dash character.
const tidy = (text: string): string =>
  (text.trim().split('\n')[0] ?? '')
    .replaceAll('\u2014', ',')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .slice(0, MAX_LINE)

export const create = (): Nudge => {
  let calls: readonly Call[] = []

  return {
    id: 'sports-narrator',
    observe: (e, ran: ToolCallResult) => {
      calls = [...calls, { label: labelOf(e), failed: ran.deny !== undefined || ran.isError === true }].slice(-MAX_CALLS)
    },
    atStop: async (tools, options) => {
      const turn = calls
      calls = []
      if (options['enabled'] !== true || turn.length === 0) return undefined
      const reply = await tools.complete({
        model: MODEL,
        system: SYSTEM,
        prompt: promptFor(turn),
        effort: 'low',
        maxTokens: 80,
        timeoutMs: 8000,
      })
      if (!reply.isAnswered) return undefined
      const line = tidy(reply.text)
      return line === '' ? undefined : line
    },
  }
}
