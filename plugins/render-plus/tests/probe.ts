import type { FsStat, PromptFillInput, RenderElement, RenderPropsOf } from 'claude-code'
import type { Mounted, TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

// The build writes the mod's own name here, so a test of a rule mounts and
// presses under whichever mod (the rule's own, or the pack) carries it.
export const PLUGIN = 'render-plus'
export const SURFACES = ['terminal', 'desktop'] as const
export type Surface = (typeof SURFACES)[number]

// The key of the stand-in for the engine's own drawing: the tree `next(e)`
// resolves to in these tests. Finding it in a drawing proves `next(e)` was used.
export const ENGINE_KEY = 'engine-drawing'

export const CWD = '/repo'

// The engine beneath the plugin draws each hooked site as one keyed Box.
export const standIn = (on: OnFn): void => {
  on('ui.log', () => ({ value: undefined }))
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return h(Box, { key: ENGINE_KEY }, h(Text, null, `${e.props.tool}(row)`)) as RenderElement
  })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return h(Box, { key: ENGINE_KEY }, h(Text, null, e.props.text)) as RenderElement
  })
  // A result block draws what its props carry: a Bash record's stdout, a
  // string as it is, so a rewrite of the props shows in the drawing.
  on('ui.render', { component: 'ToolResult' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { output } = e.props
    const shown = typeof output === 'string' ? output : typeof output === 'object' && output !== null && 'stdout' in output ? output.stdout : undefined
    return h(Box, { key: ENGINE_KEY }, h(Text, null, typeof shown === 'string' ? shown : '(result)')) as RenderElement
  })
  // The engine answers the settings hooks' events once the plugin passes them on.
  on('classic.PostToolUse', () => ({}))
  on('classic.PostToolUseFailure', () => ({}))
}

// The engine reports a call that ran `ms` milliseconds, as a session does
// once the tool returns (or failed, when `isFailed`).
export const ran = async ($: Engine, tool_use_id: string, ms: number | undefined, isFailed = false): Promise<void> => {
  const base = { tool_name: 'Bash', tool_input: { command: 'sleep 2' }, tool_use_id, ...(ms === undefined ? {} : { duration_ms: ms }) }
  if (isFailed) await $.classic.PostToolUseFailure({ ...base, error: 'Exit code 1' })
  else await $.classic.PostToolUse({ ...base, tool_response: { stdout: '', stderr: '', interrupted: false } })
}

export const toolResult = (
  tool: string,
  output: unknown,
  extra: Partial<RenderPropsOf['ToolResult']> = {},
): RenderPropsOf['ToolResult'] => ({
  tool_use_id: 'toolu_01',
  tool,
  output,
  isErrored: false,
  ...extra,
})

export const mountToolResult = ($: Engine, surface: Surface, props: RenderPropsOf['ToolResult']) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'ToolResult', requestId: props.tool_use_id, props })

// A finished Bash call's stored record.
export const bashOutput = (stdout: string, stderr = '') => ({ stdout, stderr, interrupted: false })

export const toolUse = (
  tool: string,
  input: unknown,
  extra: Partial<RenderPropsOf['ToolUse']> = {},
): RenderPropsOf['ToolUse'] => ({
  tool_use_id: 'toolu_01',
  tool,
  input,
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  ...extra,
})

export const mountToolUse = ($: Engine, surface: Surface, props: RenderPropsOf['ToolUse']) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'ToolUse', requestId: props.tool_use_id, props })

export const assistant = (text: string, isFirstOfReply = true): RenderPropsOf['AssistantMessage'] => ({
  text,
  isFirstOfReply,
})

export const mountAssistant = (
  $: Engine,
  surface: Surface,
  props: RenderPropsOf['AssistantMessage'],
): Promise<Mounted<Surface, 'AssistantMessage'>> =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'AssistantMessage', requestId: 'msg_01', props })

// The text the engine's stand-in drew for a reply: what `next(e)` was handed.
// Only for a drawing with one Text, the stand-in's.
export const drawnText = async (ui: Pick<Mounted, 'find'>): Promise<string | undefined> => (await ui.find({ type: 'Text' }))?.text

const FILE: FsStat = { kind: 'file', size: 10, mtimeMs: 0, isLink: false }
const DIR: FsStat = { kind: 'dir', size: 0, mtimeMs: 0, isLink: false }

export type Workspace = {
  // Every path `$.fs.stat` was asked about, in order.
  stats: () => readonly string[]
  fills: () => readonly PromptFillInput[]
}

// A session in CWD holding `files` (and `dirs`): `$.session.cwd()`, `$.fs.stat`
// (rejecting for anything else, as a missing path does) and the prompt box.
export const workspace = (on: OnFn, files: readonly string[], dirs: readonly string[] = []): Workspace => {
  let stats: string[] = []
  let fills: PromptFillInput[] = []
  on('session.cwd', () => ({ value: CWD }))
  on('fs.stat', (_$, e) => {
    stats = [...stats, e.path]
    if (files.includes(e.path)) return { value: FILE }
    if (dirs.includes(e.path)) return { value: DIR }
    throw new Error(`ENOENT: no such file or directory, stat '${e.path}'`)
  })
  on('prompt.fill', (_$, e) => {
    fills = [...fills, e]
    return { isFilled: true }
  })
  return { stats: () => stats, fills: () => fills }
}

// The props of a drawing's root element, or none.
export const rootProps = (drawn: RenderElement): Record<string, unknown> =>
  'props' in drawn && drawn.props !== undefined ? (drawn.props as Record<string, unknown>) : {}

export type Repo = {
  // How often `$.session.repo()` was read.
  reads: () => number
}

// A session in CWD inside a git repository whose `origin` is `remote` (null:
// none; undefined: not a repository at all), its project root CWD, and HOME.
export const repository = (on: OnFn, remote: string | null | undefined, home = '/Users/me'): Repo => {
  let reads = 0
  on('session.cwd', () => ({ value: CWD }))
  on('session.root', () => ({ value: CWD }))
  on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? home : undefined }))
  on('session.repo', () => {
    reads += 1
    return { value: remote === undefined ? null : { root: CWD, remote, internal: false, name: null } }
  })
  return { reads: () => reads }
}
