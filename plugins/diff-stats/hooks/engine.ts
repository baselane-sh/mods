import type { ElementTable, FsStat, On, RenderElement, RenderInput, RenderPropsOf, SessionRepo } from 'claude-code'

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

// One rendering rule. `toolRow` rewrites the props of the ToolUse rows of the
// named tools (`rewrite`, which changes the row alone) or draws beside them
// (`draw`); `toolResult` rewrites the props of a result block (`rewrite`) or
// draws beside it (`draw`); `assistantText` draws an assistant reply's text
// blocks. A draw or rewrite that answers undefined, or throws, leaves the
// engine's.
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
    draw: (input: AssistantDraw) => Promise<RenderElement | undefined>
  }
}

// How long each call ran, by tool_use_id. The build writes the mod's name
// over the plugin token: only the owning plugin may write the value.
const DURATIONS = { plugin: 'diff-stats', key: 'durations' } as const

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const covers = (tools: ToolSet, tool: string): boolean => tools === 'all' || tools.includes(tool)

// The settings hooks' PostToolUse events carry the tool's run time without
// the permission prompt and hook time. One pair of hooks serves every rule.
const registerTimer = (on: On): void => {
  on('classic.PostToolUse', async ($, e, next) => {
    if (e.duration_ms !== undefined) {
      await $.state.set({ ...DURATIONS, id: e.tool_use_id }, e.duration_ms).catch(error => $.ui.log(`render: no duration kept, ${reason(error)}`))
    }
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    if (e.duration_ms !== undefined) {
      await $.state.set({ ...DURATIONS, id: e.tool_use_id }, e.duration_ms).catch(error => $.ui.log(`render: no duration kept, ${reason(error)}`))
    }
    return next(e)
  })
}

const registerToolRow = (on: On, id: string, toolRow: NonNullable<RenderRule['toolRow']>): void => {
  const { rewrite, draw } = toolRow
  // ToolUse carries no ctrl+o flag, so the engine's row is always kept and
  // the rule draws beside it.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!covers(toolRow.tools, e.props.tool)) return next(e)
    let props: RenderPropsOf['ToolUse'] | undefined
    try {
      props = await rewrite?.({ props: e.props, home: () => $.env.get('HOME'), root: () => $.session.root() })
    } catch (error) {
      await $.ui.log(`${id}: drew the engine's props, ${reason(error)}`)
    }
    const row = await next(props === undefined ? e : { ...e, props })
    if (draw === undefined) return row
    try {
      // Read only by a timed rule, so the other rows do not redraw on a write.
      const durationMs = toolRow.timed ? (await $.state.get({ ...DURATIONS, id: e.props.tool_use_id })).value : undefined
      const drawn = await draw({ e, row, elements: $.ui.resolve(e), durationMs, cwd: () => $.session.cwd(), repo: () => $.session.repo() })
      return drawn ?? row
    } catch (error) {
      await $.ui.log(`${id}: drew the engine's row, ${reason(error)}`)
      return row
    }
  })
}

const registerToolResult = (on: On, id: string, toolResult: NonNullable<RenderRule['toolResult']>): void => {
  const { tools, rewrite, draw } = toolResult
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!covers(tools, e.props.tool)) return next(e)
    let props: RenderPropsOf['ToolResult'] | undefined
    try {
      props = rewrite?.(e.props)
    } catch (error) {
      await $.ui.log(`${id}: drew the engine's props, ${reason(error)}`)
    }
    const row = await next(props === undefined ? e : { ...e, props })
    if (draw === undefined) return row
    try {
      return (await draw({ e, row, elements: $.ui.resolve(e), cwd: () => $.session.cwd(), repo: () => $.session.repo() })) ?? row
    } catch (error) {
      await $.ui.log(`${id}: drew the engine's result, ${reason(error)}`)
      return row
    }
  })
}

const registerAssistantText = (on: On, id: string, assistantText: NonNullable<RenderRule['assistantText']>): void => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    try {
      const drawn = await assistantText.draw({
        e,
        elements: $.ui.resolve(e),
        cwd: () => $.session.cwd(),
        repo: () => $.session.repo(),
        stat: path => $.fs.stat(path),
        insert: text =>
          void $.prompt
            .fill({ text, mode: 'insert' })
            .catch(error => $.ui.log(`${id}: the prompt did not take ${text.trim()}, ${reason(error)}`)),
      })
      return drawn ?? next(e)
    } catch (error) {
      await $.ui.log(`${id}: drew the engine's text, ${reason(error)}`)
      return next(e)
    }
  })
}

export const registerRender = (on: On, rules: readonly RenderRule[]): void => {
  if (rules.some(rule => rule.toolRow?.timed)) registerTimer(on)
  for (const rule of rules) {
    if (rule.toolRow !== undefined) registerToolRow(on, rule.id, rule.toolRow)
    if (rule.toolResult !== undefined) registerToolResult(on, rule.id, rule.toolResult)
    if (rule.assistantText !== undefined) registerAssistantText(on, rule.id, rule.assistantText)
  }
}
