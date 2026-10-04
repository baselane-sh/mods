import type { ElementTable, FsStat, On, RenderElement, RenderInput, RenderPropsOf } from 'claude-code'

// Which tools a rule draws on: a list of names, or every tool.
export type ToolSet = readonly string[] | 'all'

// What a tool row rule draws from: the row's input, the engine's own drawing
// of it (`next(e)`), and the surface's elements. `durationMs` is how long the
// call ran, given to a `timed` rule once the call has ended in this session.
export type ToolRowDraw = {
  e: RenderInput<'ToolUse'>
  row: RenderElement
  elements: ElementTable
  durationMs?: number
}

// What a tool result rule draws from: the result block's input, the engine's
// drawing of it, and the surface's elements.
export type ToolResultDraw = {
  e: RenderInput<'ToolResult'>
  row: RenderElement
  elements: ElementTable
}

// What an assistant text rule draws from. `$` never leaves the engine's hook,
// so the calls a rule needs come as closures over it.
export type AssistantDraw = {
  e: RenderInput<'AssistantMessage'>
  elements: ElementTable
  cwd: () => Promise<string>
  stat: (path: string) => Promise<FsStat>
  insert: (text: string) => void
}

// One rendering rule. `toolRow` draws on the ToolUse rows of the named tools;
// `toolResult` rewrites the props of a result block (`rewrite`) or draws
// beside it (`draw`); `assistantText` draws an assistant reply's text blocks.
// A draw or rewrite that answers undefined, or throws, leaves the engine's.
export type RenderRule = {
  id: string
  toolRow?: {
    tools: ToolSet
    timed?: true
    draw: (input: ToolRowDraw) => RenderElement | undefined
  }
  toolResult?: {
    tools: ToolSet
    rewrite?: (props: RenderPropsOf['ToolResult']) => RenderPropsOf['ToolResult'] | undefined
    draw?: (input: ToolResultDraw) => RenderElement | undefined
  }
  assistantText?: {
    draw: (input: AssistantDraw) => Promise<RenderElement | undefined>
  }
}

// How long each call ran, by tool_use_id. The build writes the mod's name
// over the plugin token: only the owning plugin may write the value.
const DURATIONS = { plugin: 'render-mods', key: 'durations' } as const

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
  // ToolUse carries no ctrl+o flag, so the engine's row is always kept and
  // the rule draws beside it.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!covers(toolRow.tools, e.props.tool)) return next(e)
    const row = await next(e)
    try {
      // Read only by a timed rule, so the other rows do not redraw on a write.
      const durationMs = toolRow.timed ? (await $.state.get({ ...DURATIONS, id: e.props.tool_use_id })).value : undefined
      return toolRow.draw({ e, row, elements: $.ui.resolve(e), durationMs }) ?? row
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
      return draw({ e, row, elements: $.ui.resolve(e) }) ?? row
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
