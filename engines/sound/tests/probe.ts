import type { ToolCallResult } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

export type Played = { asset: string | undefined; gain: number | undefined }

// What the tool beneath the sounds answers with.
export type Outcome = 'ok' | 'error' | 'deny'

export type SoundProbe = {
  plays: () => readonly Played[]
  bash: (command: string, outcome?: Outcome) => Promise<ToolCallResult>
  turn: (extra?: { agentId?: string }) => Promise<void>
  logs: () => readonly string[]
}

// Stands in for the engine beneath the sounds: `audio.play` records the clip
// (or throws, when `audioFails`), tools answer as `outcome` says, and a turn
// ends cleanly.
export const probe = ($: Engine, on: OnFn, audioFails = false): SoundProbe => {
  let played: Played[] = []
  let logged: string[] = []
  let outcome: Outcome = 'ok'
  let turns = 0

  on('audio.play', (_$, e) => {
    if (audioFails) throw new Error('no audio device')
    played = [...played, { asset: e.clip.asset, gain: e.gain }]
    return { value: undefined }
  })
  on('ui.log', (_$, e) => {
    logged = [...logged, e.text]
    return { value: undefined }
  })
  on('tool.call', () => {
    if (outcome === 'deny') return { deny: 'blocked by a rule' }
    if (outcome === 'error') return { result: 'exit 1', isError: true as const, text: 'exit 1' }
    return { result: { stdout: 'ok', stderr: '', interrupted: false }, text: 'ok' }
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  return {
    plays: () => played,
    logs: () => logged,
    bash: (command, next = 'ok') => {
      outcome = next
      return $.tool.call({ tool: 'Bash', command })
    },
    turn: async extra => {
      turns += 1
      if (extra?.agentId === undefined) await $.turn.start({ text: 'go', turnId: `t${turns}` })
      await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: `t${turns}`, reason: 'answer', ...extra })
    },
  }
}
