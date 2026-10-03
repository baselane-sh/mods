import type { PaneOpenArgs, ToolCallArgs, ToolCallResult } from 'claude-code'
import type { Mounted, TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

export const PLUGIN = 'agent-firewall'
export const PANE = 'firewall'
export const SURFACES = ['terminal', 'desktop'] as const
export type Surface = (typeof SURFACES)[number]

// 2026-10-04 12:34:56 UTC; rows show the time of day the host clock gives.
export const NOW = Date.UTC(2026, 9, 4, 12, 34, 56)

// How the engine beneath answers the next call.
export type Answer = 'ran' | 'asked' | 'blocked' | 'error'

export const paneProps = (bodyColumns: number) =>
  ({
    title: 'Agent Firewall',
    isFocused: false,
    bodyColumns,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  }) as const

export type FirewallProbe = {
  call: (input: ToolCallArgs, answer?: Answer) => Promise<ToolCallResult>
  bash: (command: string, answer?: Answer) => Promise<ToolCallResult>
  mount: (surface: Surface, bodyColumns?: number) => Promise<Mounted<Surface, 'Pane'>>
  command: () => Promise<{ text?: string }>
  start: () => Promise<unknown>
  statuses: () => readonly (string | undefined)[]
  opens: () => readonly PaneOpenArgs[]
  closes: () => readonly string[]
  commands: () => readonly string[]
}

// Stands in for the engine beneath the plugin. Each call first runs the
// permission check as core does (`tool.check` with the call's id, inside
// the call), answering `ask` for an asked call, then answers as told.
export const probe = ($: Engine, on: OnFn): FirewallProbe => {
  let answer: Answer = 'ran'
  let isOpen = false
  let statuses: (string | undefined)[] = []
  let opens: PaneOpenArgs[] = []
  let closes: string[] = []
  let commands: string[] = []

  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.status', (_$, e) => {
    statuses = [...statuses, e.text]
    return { value: undefined }
  })
  on('ui.open', (_$, e) => {
    opens = [...opens, e]
    isOpen = true
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    closes = [...closes, e.id]
    isOpen = false
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: isOpen ? [{ id: PANE, title: 'Agent Firewall', isShown: true, isFocused: false, isPlaced: true }] : [],
  }))
  on('command.register', (_$, e) => {
    commands = [...commands, e.name]
    return { value: { command: e.name } }
  })
  on('tool.check', () => ({ decision: answer === 'asked' ? 'ask' : 'allow' }))
  on('tool.call', async (_$, e) => {
    await $.tool.check({ tool: e.tool, input: {}, tool_use_id: e.tool_use_id })
    if (answer === 'blocked') return { deny: 'blocked by a rule' }
    if (answer === 'error') return { isError: true, result: 'boom', text: 'boom' }
    return { result: { stdout: '', stderr: '', interrupted: false }, text: '' }
  })

  const call = (input: ToolCallArgs, next: Answer = 'ran') => {
    answer = next
    return $.tool.call(input)
  }

  return {
    call,
    bash: (command, next) => call({ tool: 'Bash', command }, next),
    mount: (surface, bodyColumns = 80) =>
      $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: paneProps(bodyColumns) }),
    command: () =>
      $.command.run({
        command: 'firewall',
        args: '',
        origin: { kind: 'composer' },
        presentation: { isFullscreen: true, columns: 160 },
      }),
    start: () => $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true }),
    statuses: () => statuses,
    opens: () => opens,
    closes: () => closes,
    commands: () => commands,
  }
}
