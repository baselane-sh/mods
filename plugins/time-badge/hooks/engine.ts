import type { ElementTable, FsStat, RenderElement, RenderInput, RenderPropsOf, SessionRepo } from 'claude-code'

// Which tools a rule draws on: a list of names, or every tool.
export type ToolSet = readonly string[] | 'all'

// Reads a draw may make, as closures over `$` (a rule never holds `$`).
// `repo` is the session's git repository, or null outside one.
export type Reads = {
  cwd: () => Promise<string>
  repo: () => Promise<SessionRepo | null>
}

// A draw may answer at once or after its reads.
type Drawn = RenderElement | undefined | Promise<RenderElement | undefined>

// What a tool row rule draws from: the row's input, the engine's own drawing
// of it (`next(e)`), and the surface's elements. `durationMs` is how long the
// call ran, given to a `timed` rule once the call has ended in this session.
export type ToolRowDraw = Reads & {
  e: RenderInput<'ToolUse'>
  row: RenderElement
  elements: ElementTable
  durationMs?: number
}

// What a tool row rewrite reads: the row's props, the person's home folder
// and the session's project root.
export type ToolRowRewrite = {
  props: RenderPropsOf['ToolUse']
  home: () => Promise<string | undefined>
  root: () => Promise<string>
}

// What a tool result rule draws from: the result block's input, the engine's
// drawing of it, and the surface's elements.
export type ToolResultDraw = Reads & {
  e: RenderInput<'ToolResult'>
  row: RenderElement
  elements: ElementTable
}

// What an assistant text rule draws from. `$` never leaves the engine's hook,
// so the calls a rule needs come as closures over it.
export type AssistantDraw = Reads & {
  e: RenderInput<'AssistantMessage'>
  elements: ElementTable
  stat: (path: string) => Promise<FsStat>
  insert: (text: string) => void
}

// What an assistant text rewrite reads: the block, and the session's reads.
export type AssistantRewrite = Reads & { e: RenderInput<'AssistantMessage'> }

// One rendering rule. `toolRow` rewrites the props of the ToolUse rows of the
// named tools (`rewrite`, which changes the row alone) or draws beside them
// (`draw`); `toolResult` rewrites the props of a result block (`rewrite`) or
// draws beside it (`draw`); `assistantText` rewrites an assistant reply's
// text (`rewrite`, handed on to the hooks beneath, so rules of several mods
// stack) or draws the block itself (`draw`). A draw or rewrite that answers
// undefined, or throws, leaves the engine's.
export type RenderRule = {
  id: string
  toolRow?: {
    tools: ToolSet
    timed?: true
    rewrite?: (input: ToolRowRewrite) => Promise<RenderPropsOf['ToolUse'] | undefined>
    draw?: (input: ToolRowDraw) => Drawn
  }
  toolResult?: {
    tools: ToolSet
    rewrite?: (props: RenderPropsOf['ToolResult']) => RenderPropsOf['ToolResult'] | undefined
    draw?: (input: ToolResultDraw) => Drawn
  }
  assistantText?: {
    rewrite?: (input: AssistantRewrite) => Promise<string | undefined>
    draw?: (input: AssistantDraw) => Promise<RenderElement | undefined>
  }
}

export const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const covers = (tools: ToolSet, tool: string): boolean => tools === 'all' || tools.includes(tool)

// The calls a host does not give. A rule that makes one has its draw logged
// and skipped, and its tests fail: name what it uses in engine.json `needs`.
export const absent = (name: string) => (): Promise<never> =>
  Promise.reject(new Error(`${name} is not given to this mod; name it in engine.json needs`))

export const NO_READS: Reads = { cwd: absent('cwd'), repo: absent('repo') }

type Log = (text: string) => unknown

// What a tool row hook hands its rule, as closures over the hook's `$`.
export type RowHost = Reads & {
  home: () => Promise<string | undefined>
  root: () => Promise<string>
  duration: () => Promise<number | undefined>
  elements: () => ElementTable
  log: Log
}

export const NO_ROW_READS = { ...NO_READS, home: absent('home'), root: absent('root'), duration: absent('duration') }

// ToolUse carries no ctrl+o flag, so the engine's row is always kept and the
// rule draws beside it.
export const drawToolRow = async (
  id: string,
  toolRow: NonNullable<RenderRule['toolRow']>,
  e: RenderInput<'ToolUse'>,
  next: (e: RenderInput<'ToolUse'>) => Promise<RenderElement>,
  host: RowHost,
): Promise<RenderElement> => {
  const { rewrite, draw } = toolRow
  if (!covers(toolRow.tools, e.props.tool)) return next(e)
  let props: RenderPropsOf['ToolUse'] | undefined
  try {
    props = await rewrite?.({ props: e.props, home: host.home, root: host.root })
  } catch (error) {
    await host.log(`${id}: drew the engine's props, ${reason(error)}`)
  }
  const row = await next(props === undefined ? e : { ...e, props })
  if (draw === undefined) return row
  try {
    // Read only by a timed rule, so the other rows do not redraw on a write.
    const durationMs = toolRow.timed ? await host.duration() : undefined
    const drawn = await draw({ e, row, elements: host.elements(), durationMs, cwd: host.cwd, repo: host.repo })
    return drawn ?? row
  } catch (error) {
    await host.log(`${id}: drew the engine's row, ${reason(error)}`)
    return row
  }
}

// What a tool result hook hands its rule, as closures over the hook's `$`.
export type ResultHost = Reads & { elements: () => ElementTable; log: Log }

export const drawToolResult = async (
  id: string,
  toolResult: NonNullable<RenderRule['toolResult']>,
  e: RenderInput<'ToolResult'>,
  next: (e: RenderInput<'ToolResult'>) => Promise<RenderElement>,
  host: ResultHost,
): Promise<RenderElement> => {
  const { tools, rewrite, draw } = toolResult
  if (!covers(tools, e.props.tool)) return next(e)
  let props: RenderPropsOf['ToolResult'] | undefined
  try {
    props = rewrite?.(e.props)
  } catch (error) {
    await host.log(`${id}: drew the engine's props, ${reason(error)}`)
  }
  const row = await next(props === undefined ? e : { ...e, props })
  if (draw === undefined) return row
  try {
    return (await draw({ e, row, elements: host.elements(), cwd: host.cwd, repo: host.repo })) ?? row
  } catch (error) {
    await host.log(`${id}: drew the engine's result, ${reason(error)}`)
    return row
  }
}

// What an assistant text hook hands its rule, as closures over the hook's `$`.
export type TextHost = Reads & {
  elements: () => ElementTable
  stat: (path: string) => Promise<FsStat>
  insert: (text: string) => void
  log: Log
}

export const NO_TEXT_READS = { ...NO_READS, stat: absent('stat'), insert: () => {
  throw new Error('insert is not given to this mod; name it in engine.json needs')
} }

export const drawAssistantText = async (
  id: string,
  assistantText: NonNullable<RenderRule['assistantText']>,
  e: RenderInput<'AssistantMessage'>,
  next: (e: RenderInput<'AssistantMessage'>) => Promise<RenderElement>,
  host: TextHost,
): Promise<RenderElement> => {
  const { rewrite, draw } = assistantText
  let text: string | undefined
  try {
    text = await rewrite?.({ e, cwd: host.cwd, repo: host.repo })
  } catch (error) {
    await host.log(`${id}: drew the engine's text, ${reason(error)}`)
  }
  // The rewrite goes on through `next`, so a link rule of another mod beneath
  // this one adds its links to ours. The other props are carried as received.
  const passed = text === undefined || text === e.props.text ? e : { ...e, props: { ...e.props, text } }
  if (draw === undefined) return next(passed)
  try {
    const drawn = await draw({ e: passed, elements: host.elements(), cwd: host.cwd, repo: host.repo, stat: host.stat, insert: host.insert })
    return drawn ?? next(passed)
  } catch (error) {
    await host.log(`${id}: drew the engine's text, ${reason(error)}`)
    return next(passed)
  }
}
