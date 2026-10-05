import type { Mounted, TestBody } from 'claude-code/testing'
import { mock } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

// The build writes the mod's own name here: `$.state` is owned by the plugin
// that declares it, so each mod of this engine keeps its state under its name.
export const PLUGIN = 'now-playing'
export const SURFACES = ['terminal', 'desktop'] as const
export type Surface = (typeof SURFACES)[number]

// 2026-10-04 12:00 local time, so a day rollover is a fixed 12 hours away
// whatever zone the test runs in.
export const NOON = new Date(2026, 9, 4, 12, 0, 0).getTime()
export const HOUR = 3_600_000
export const TODAY_KEY = 'daily:2026-10-04'
export const TOMORROW_KEY = 'daily:2026-10-05'

export const bandProps = (bodyColumns: number, hasSurvey = false) =>
  ({
    hasSurvey,
    isWorking: false,
    maxRows: 10,
    bodyColumns,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  }) as const

// `startedAt` and `model` are what the session reports besides its usage.
export type Reading = { usd?: number; percent?: number; startedAt?: number; model?: string }

// What a `git status --porcelain -b` answers by default: main, two files changed.
export const GIT_DEFAULT = '## main...origin/main\n M a.ts\n?? b.ts\n'

// A Bash command containing this word is denied beneath the mod; one
// containing FAIL runs and comes back as an error.
export const DENY_WORD = 'DENYME'
export const FAIL_WORD = 'FAILME'

export type Segment = { key: string; text: string; color?: unknown }

// What a command other than git status answers: its output, or a command that
// cannot start (`'reject'`, the binary is not there). `delayMs` is a slow
// command, asleep on the test's clock.
export type CommandReply =
  | { exitCode?: number; stdout?: string; delayMs?: number }
  | 'reject'
  // Answers by the argv it was run with.
  | ((argv: readonly string[]) => Exclude<CommandReply, (argv: readonly string[]) => unknown>)

// What `wake` makes the commands answer, unless a test set them.
const SAMPLE_REPLIES: Readonly<Record<string, CommandReply>> = {
  pmset: { stdout: "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t87%; discharging; 4:12 remaining\n" },
  pgrep: { stdout: '123\n' },
  osascript: { stdout: 'Song - Artist\n' },
  gh: { stdout: '[{"status":"completed","conclusion":"success"}]' },
  'git grep': { stdout: 'a.ts:2\n' },
  // The beads tracker, by its read command.
  bd: argv => {
    const words = argv.filter(arg => arg !== '--json').slice(1).join(' ')
    if (words === 'status') return { stdout: '{"summary":{"total_issues":10,"closed_issues":7,"in_progress_issues":1,"blocked_issues":1,"ready_issues":2}}' }
    if (words.startsWith('list ')) return { stdout: '[{"id":"bd-1.2","title":"Draw the band","updated_at":"2026-10-04T09:00:00Z","parent":"bd-1"}]' }
    if (words === 'epic status') return { stdout: '[{"epic":{"id":"bd-1","status":"open"},"total_children":4,"closed_children":3}]' }
    if (words.startsWith('count --by-priority')) return { stdout: JSON.stringify({ groups: [{ group: 'P1', count: words.includes('closed') ? 1 : 3 }] }) }
    if (words.startsWith('count ')) return { stdout: '{"count":2}' }
    return { exitCode: 1 }
  },
}

// What a turn spent on the prompt cache, as the API reports it.
export type CacheUsage = { input: number; cacheRead: number; cacheWrite: number }

const SAMPLE_USAGE: CacheUsage = { input: 10, cacheRead: 90, cacheWrite: 0 }

export type BandProbe = {
  // A whole turn: turn.start sees the cost as it stands, the turn spends,
  // then turn.complete reads the new figures.
  // `null` is a turn whose requests reported no usage.
  turn: (after: Reading, usage?: CacheUsage | null) => Promise<void>
  // Only the turn.complete, with no turn.start before it.
  complete: (after: Reading, extra?: { agentId?: string; usage?: CacheUsage }) => Promise<void>
  // Only the turn.start: a turn that is running.
  begin: () => Promise<void>
  mount: (surface: Surface, bodyColumns?: number, hasSurvey?: boolean) => Promise<Mounted<Surface, 'AbovePrompt'>>
  segments: (ui: Mounted<Surface, 'AbovePrompt'>) => Promise<Segment[]>
  advance: (ms: number) => Promise<void>
  // Lets what is under way run as far as it can, the clock where it is.
  settle: () => Promise<void>
  logs: () => readonly string[]
  // What the mod wrote to its store, by key, as written.
  writes: () => Readonly<Record<string, unknown>>
  breakUsage: () => void
  // One Bash call: it passes, or fails or is denied by the word it holds.
  bash: (command: string) => Promise<unknown>
  // Raises session.start, the way the session does.
  start: () => Promise<void>
  // Raises session.end, the way the session does.
  end: (reason?: 'clear' | 'other') => Promise<void>
  // One call of any tool (Edit, Write, Read...): it passes.
  tool: (name: string) => Promise<unknown>
  // Every later call of this tool comes back as an error.
  failTool: (name: string) => void
  // What `git status --porcelain -b` answers from now on; null is not a repository.
  setGit: (output: string | null) => void
  // How many times the mod ran git.
  gitRuns: () => number
  // The next git run answers `output` (null is not a repository) once the
  // clock has moved `ms` on: a slow git, asleep on the test's clock.
  slowGit: (ms: number, output: string | null) => void
  // What a command answers from now on, by its name (`pmset`, `gh`), or `git
  // grep` for a git subcommand. Unset, a command exits 128 with no output.
  setCommand: (key: string, reply: CommandReply) => void
  // The argv of each run of a command so far, oldest first.
  calls: (key: string) => readonly (readonly string[])[]
  // The timeout each run of a command asked for, in milliseconds, oldest first.
  timeouts: (key: string) => readonly (number | undefined)[]
  // Writes a state value of the mod's beneath it, as a value it held before.
  seedState: (key: string, value: unknown) => void
  // Runs `/<name>` and answers its output text.
  run: (name: string) => Promise<string>
  toasts: () => readonly string[]
  registered: () => readonly string[]
  // How many times the mod wrote the state value `key` (any owner).
  stateWrites: (key: string) => number
  // How many times the mod read the state value `key` (any owner). A read
  // while the band draws is what makes a later write draw it again.
  stateReads: (key: string) => number
  // How many times the mod asked the session for its model.
  modelReads: () => number
  // Gives a mod that draws from live activity something to show: a few tool
  // calls, a turn that is running, commands that answer, and /pomodoro where
  // the mod has it. Call it after the turn ends: a turn timer hides then. A mod without that command
  // has nothing to run, which is not a failure.
  wake: () => Promise<void>
}

// Stands in for the engine beneath the mod: the clock and store are the
// test kit's, `session.usage` answers `now` and a test moves it.
export const probe = (
  $: Engine,
  on: OnFn,
  start: Reading = {},
  store: Readonly<Record<string, unknown>> = {},
  // The clock at the start, in milliseconds.
  at: number = NOON,
): BandProbe => {
  let now: Reading = start
  let isBroken = false
  let gitOutput: string | null = GIT_DEFAULT
  let gitRuns = 0
  // Slow git runs to come, oldest first.
  let slow: readonly { ms: number; output: string | null }[] = []
  let failing: readonly string[] = []
  let replies: Readonly<Record<string, CommandReply>> = {}
  let called: Readonly<Record<string, readonly (readonly string[])[]>> = {}
  let limits: Readonly<Record<string, readonly (number | undefined)[]>> = {}
  let logs: string[] = []
  let turns = 0
  let written: Record<string, unknown> = {}
  let toasts: string[] = []
  let registered: string[] = []
  let writes: Record<string, number> = {}
  let reads: Record<string, number> = {}
  let modelReads = 0

  const clock = mock.clock(on, { now: at })
  // The kit's mock.store answers the same four calls from memory, but only
  // one hook may answer each event, and these tests read the writes back.
  let kept: Record<string, unknown> = { ...store }
  on('store.get', (_$, e) => ({ value: kept[e.key] }))
  on('store.set', (_$, e) => {
    kept = { ...kept, [e.key]: e.value }
    written = { ...written, [e.key]: e.value }
    return { value: undefined }
  })
  on('store.delete', (_$, e) => {
    const { [e.key]: _gone, ...rest } = kept
    kept = rest
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(kept) }))
  on('session.usage', () => {
    if (isBroken) throw new Error('usage is down')
    return {
      value: {
        // NaN stands for a session that reports no start: the engine leaves it out.
        startedAt: now.startedAt ?? Number.NaN,
        context: { window: 200_000, ...(now.percent === undefined ? {} : { tokens: now.percent * 2000, percent: now.percent }) },
        rateLimits: [],
        ...(now.usd === undefined ? {} : { cost: { usd: now.usd } }),
      },
    }
  })
  // The state is the test's own so each write can be counted.
  const state = new Map<string, { value: unknown; version: number }>()
  on('state.get', (_$, e) => {
    reads = { ...reads, [e.key]: (reads[e.key] ?? 0) + 1 }
    const held = state.get(`${e.plugin}.${e.key}`)
    return { value: { value: held?.value, version: held?.version ?? 0 } }
  })
  on('state.set', (_$, e) => {
    const name = `${e.plugin}.${e.key}`
    const version = state.get(name)?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== version) return { value: { isSet: false as const, version } }
    state.set(name, { value: e.value, version: version + 1 })
    writes = { ...writes, [e.key]: (writes[e.key] ?? 0) + 1 }
    return { value: { isSet: true as const, version: version + 1 } }
  })
  on('session.model', () => {
    modelReads += 1
    return { value: now.model ?? '' }
  })
  on('process.run', async (_$, e) => {
    const isGit = e.argv[0] === 'git' && e.argv.includes('status')
    if (e.argv[0] !== undefined && !isGit) {
      const sub = e.argv[0] === 'git' ? e.argv.find((arg, at) => at > 0 && !arg.startsWith('-')) : undefined
      const key = sub === undefined ? e.argv[0] : `git ${sub}`
      called = { ...called, [key]: [...(called[key] ?? []), e.argv] }
      limits = { ...limits, [key]: [...(limits[key] ?? []), e.init?.timeoutMs] }
      const held = replies[key]
      const reply = typeof held === 'function' ? held(e.argv) : held
      if (reply === 'reject') throw new Error(`${key}: command not found`)
      if (reply?.delayMs !== undefined) await clock.sleep(reply.delayMs)
      return {
        value: {
          exitCode: reply?.exitCode ?? (reply === undefined ? 128 : 0),
          stdout: reply?.stdout ?? '',
          stderr: '',
          isStdoutTruncated: false,
          isStderrTruncated: false,
        },
      }
    }
    if (isGit) gitRuns += 1
    const late = isGit ? slow[0] : undefined
    if (late !== undefined) {
      slow = slow.slice(1)
      await clock.sleep(late.ms)
    }
    const output = late === undefined ? gitOutput : late.output
    return {
      value: {
        exitCode: isGit && output !== null ? 0 : 128,
        stdout: output ?? '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_$, e) => {
    registered = [...registered, e.name]
    return { value: { command: e.name } }
  })
  on('ui.toast', (_$, e) => {
    toasts = [...toasts, e.text]
    return { value: undefined }
  })
  on('tool.call', (_$, e) => {
    if (failing.includes(e.tool)) return { result: {}, isError: true }
    const command = e.tool === 'Bash' ? e.command : ''
    if (command.includes(DENY_WORD)) return { deny: 'blocked by test' }
    if (command.includes(FAIL_WORD)) return { result: {}, isError: true }
    return { result: {} }
  })
  on('ui.log', (_$, e) => {
    logs = [...logs, e.text]
    return { value: undefined }
  })
  // What the engine draws when the band yields: something that is not the band.
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine own'] }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  const complete = async (after: Reading, extra: { agentId?: string; usage?: CacheUsage } = {}) => {
    now = after
    turns += 1
    const { usage, ...rest } = extra
    await $.turn.complete({
      answer: '',
      durationMs: 1,
      isAborted: false,
      turnId: `t${turns}`,
      reason: 'answer',
      ...rest,
      ...(usage === undefined
        ? {}
        : {
            usage: {
              model: 'm',
              input_tokens: usage.input,
              output_tokens: 1,
              cache_read_input_tokens: usage.cacheRead,
              cache_creation_input_tokens: usage.cacheWrite,
            },
          }),
    })
    // What the turn end set going (a command) runs as far as it can.
    await clock.settle()
  }

  return {
    complete,
    begin: async () => {
      await $.turn.start({ text: 'go', turnId: `t${turns + 1}` })
      await clock.settle()
    },
    // A turn, like a real one, spent something on the prompt cache.
    turn: async (after, usage = SAMPLE_USAGE) => {
      await $.turn.start({ text: 'go', turnId: `t${turns + 1}` })
      await complete(after, usage === null ? {} : { usage })
    },
    mount: (surface, bodyColumns = 80, hasSurvey = false) =>
      $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: bandProps(bodyColumns, hasSurvey) }),
    segments: async ui => {
      const texts = await ui.findAll({ type: 'Text' })
      return (await ui.findAll({ type: 'Box' }))
        .filter(box => box.key !== undefined && box.key !== 'band' && !box.key.startsWith('gap-'))
        .map(box => ({ key: box.key ?? '', text: box.text, color: texts.find(text => text.text === box.text)?.props.color }))
    },
    advance: ms => clock.advance(ms),
    settle: () => clock.settle(),
    // Each call settles after it, so what it set going (a git read) is done
    // unless it sleeps on the clock.
    bash: async command => {
      const ran = await $.tool.call({ tool: 'Bash', command })
      await clock.settle()
      return ran
    },
    // The tool name is free text here: the kit's `tool.call` types by name, so
    // the call goes in loose, as the engine would see any tool.
    tool: async name => {
      const ran = await $.tool.call({ tool: name, ...(name === 'Bash' ? { command: 'ls' } : {}) } as Parameters<typeof $.tool.call>[0])
      await clock.settle()
      return ran
    },
    failTool: name => {
      failing = [...failing, name]
    },
    setGit: output => {
      gitOutput = output
    },
    gitRuns: () => gitRuns,
    slowGit: (ms, output) => {
      slow = [...slow, { ms, output }]
    },
    setCommand: (key, reply) => {
      replies = { ...replies, [key]: reply }
    },
    calls: key => called[key] ?? [],
    timeouts: key => limits[key] ?? [],
    seedState: (key, value) => {
      const name = `${PLUGIN}.${key}`
      state.set(name, { value, version: (state.get(name)?.version ?? 0) + 1 })
    },
    start: async () => {
      await $.session.start({ cwd: '/repo', surface: null, isInteractive: true })
    },
    end: async (reason = 'other') => {
      await $.session.end({ reason, sessionId: 's', resume: { id: 's' } })
    },
    run: async name =>
      (await $.command.run({ command: name, args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })).text ??
      '',
    wake: async () => {
      // Commands nobody set answer a sample, so a mod that draws from one has a figure.
      for (const [key, reply] of Object.entries(SAMPLE_REPLIES)) replies = { [key]: reply, ...replies }
      await $.tool.call({ tool: 'Bash', command: 'ls' })
      await $.tool.call({ tool: 'Edit' } as Parameters<typeof $.tool.call>[0])
      await $.turn.start({ text: 'go', turnId: `t${turns + 1}` })
      try {
        await $.command.run({ command: 'pomodoro', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
      } catch {
        // No /pomodoro in this mod.
      }
      // Past two ticks of the minute, so what asks a command on a rate has asked.
      await clock.advance(120_000)
    },
    toasts: () => toasts,
    registered: () => registered,
    stateWrites: key => writes[key] ?? 0,
    stateReads: key => reads[key] ?? 0,
    modelReads: () => modelReads,
    logs: () => logs,
    writes: () => written,
    breakUsage: () => {
      isBroken = true
    },
  }
}
