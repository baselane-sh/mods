import type { PaneOpenArgs, ProcessRunResult, ToolCallArgs, ToolCallResult } from 'claude-code'
import type { MockClock, Mounted, TestBody } from 'claude-code/testing'
import { mock } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

// The build writes the mod's own name here: `$.state` is owned by the plugin
// that declares it, so each mod of this engine keeps its state under its name.
export const PLUGIN = 'pane-mods'
export const SURFACES = ['terminal', 'desktop'] as const
export type Surface = (typeof SURFACES)[number]

export const CWD = '/repo'
// 2026-10-04 12:34:56 local time.
export const NOW = new Date(2026, 9, 4, 12, 34, 56).getTime()

// How a faked command answers: its output, or a failure to start.
export type Answer = Partial<ProcessRunResult> | { reject: string }

export const paneProps = (bodyColumns: number) =>
  ({
    title: 'pane',
    isFocused: false,
    bodyColumns,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  }) as const

// How the engine beneath answers a tool call: the text the model reads, and
// whether the tool reported an error.
// `tookMs`: how long the call runs, on the mocked clock.
export type ToolAnswer = { text?: string; isError?: boolean; tookMs?: number }

export type PaneProbe = {
  clock: MockClock
  start: () => Promise<unknown>
  command: (name: string) => Promise<{ text?: string }>
  call: (input: ToolCallArgs, answer?: ToolAnswer) => Promise<ToolCallResult>
  bash: (command: string, answer?: ToolAnswer) => Promise<ToolCallResult>
  mount: (surface: Surface, pane: string, bodyColumns?: number) => Promise<Mounted<Surface, 'Pane'>>
  // The texts of the pane's lines, top to bottom.
  lines: (ui: Mounted<Surface, 'Pane'>) => Promise<string[]>
  // Every command the plugin ran, as argv joined by spaces.
  runs: () => readonly string[]
  answer: (argv: string, answer: Answer) => void
  setCwd: (cwd: string) => void
  // The person closes the pane (Esc or its close mark): the engine stops
  // listing it. The kit cannot raise `ui.close` itself.
  personClose: (pane: string) => void
  opens: () => readonly PaneOpenArgs[]
  closes: () => readonly string[]
  commands: () => readonly string[]
  logs: () => readonly string[]
  // The session cost `$.session.usage()` reports; undefined leaves `cost` out,
  // as a host with no cost ledger does.
  setUsd: (usd: number | undefined) => void
  // A whole turn: turn.start, the cost moves to `usd` when given, then
  // turn.complete. A subagent's turn raises no turn.start.
  turn: (usd?: number, extra?: { agentId?: string }) => Promise<void>
}

const result = (answer: Partial<ProcessRunResult>): ProcessRunResult => ({
  exitCode: 0,
  stdout: '',
  stderr: '',
  isStdoutTruncated: false,
  isStderrTruncated: false,
  ...answer,
})

// Stands in for the engine beneath the plugin: the clock is the kit's,
// `process.run` answers by argv from `world`, and an argv it was not told
// about fails to start, so a test sees every command the plugin ran.
export const probe = ($: Engine, on: OnFn, world: Readonly<Record<string, Answer>> = {}): PaneProbe => {
  const clock = mock.clock(on, { now: NOW })
  let answers: Record<string, Answer> = { ...world }
  let cwd = CWD
  let open: string[] = []
  let runs: string[] = []
  let opens: PaneOpenArgs[] = []
  let closes: string[] = []
  let commands: string[] = []
  let logs: string[] = []
  let next: ToolAnswer = {}
  let usd: number | undefined
  let turns = 0

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', (_$, e) => {
    const key = e.argv.join(' ')
    runs = [...runs, key]
    const answer = answers[key]
    if (answer === undefined) throw new Error(`no fake for: ${key}`)
    if ('reject' in answer) throw new Error(answer.reject)
    return { value: result(answer) }
  })
  on('ui.log', (_$, e) => {
    logs = [...logs, e.text]
    return { value: undefined }
  })
  on('ui.open', (_$, e) => {
    opens = [...opens, e]
    open = [...open.filter(id => id !== e.id), e.id]
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    closes = [...closes, e.id]
    open = open.filter(id => id !== e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: open.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })),
  }))
  on('command.register', (_$, e) => {
    commands = [...commands, e.name]
    return { value: { command: e.name } }
  })
  on('session.usage', () => ({
    value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: [], ...(usd === undefined ? {} : { cost: { usd } }) },
  }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', async () => {
    const answer = next
    if (answer.tookMs !== undefined) await clock.sleep(answer.tookMs)
    return answer.isError === true
      ? { isError: true, result: answer.text, text: answer.text ?? '' }
      : { result: { stdout: answer.text ?? '', stderr: '', interrupted: false }, text: answer.text ?? '' }
  })

  const call = async (input: ToolCallArgs, answer: ToolAnswer = {}) => {
    next = answer
    const pending = $.tool.call(input)
    if (answer.tookMs !== undefined) {
      await clock.settle()
      await clock.advance(answer.tookMs)
    }
    const ran = await pending
    // A refresh a call sets off is not awaited by the call itself.
    await clock.settle()
    return ran
  }

  return {
    clock,
    start: () => $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true }),
    command: async name => {
      const answered = await $.command.run({
        command: name,
        args: '',
        origin: { kind: 'composer' },
        presentation: { isFullscreen: true, columns: 160 },
      })
      await clock.settle()
      return answered
    },
    call,
    bash: (command, answer) => call({ tool: 'Bash', command }, answer),
    mount: (surface, pane, bodyColumns = 72) =>
      $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: pane, props: paneProps(bodyColumns) }),
    lines: async ui =>
      (await ui.findAll({ type: 'Box' })).filter(box => box.key?.startsWith('line-')).map(box => box.text),
    runs: () => runs,
    answer: (argv, answer) => {
      answers = { ...answers, [argv]: answer }
    },
    setCwd: next => {
      cwd = next
    },
    personClose: pane => {
      open = open.filter(id => id !== pane)
    },
    opens: () => opens,
    closes: () => closes,
    commands: () => commands,
    logs: () => logs,
    setUsd: value => {
      usd = value
    },
    turn: async (after, extra = {}) => {
      turns += 1
      const turnId = `t${turns}`
      if (extra.agentId === undefined) await $.turn.start({ text: 'go', turnId })
      if (after !== undefined) usd = after
      await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId, reason: 'answer', ...extra })
      await clock.settle()
    },
  }
}
