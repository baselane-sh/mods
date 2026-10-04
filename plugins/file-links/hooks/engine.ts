import type { ElementTable, FsStat, On, RenderElement, RenderInput } from 'claude-code'

// What a tool row rule draws from: the row's input, the engine's own drawing
// of it (`next(e)`), and the surface's elements.
export type ToolRowDraw = {
  e: RenderInput<'ToolUse'>
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
// `assistantText` on an assistant reply's text blocks. A draw that answers
// undefined, or throws, leaves the engine's drawing.
export type RenderRule = {
  id: string
  toolRow?: {
    tools: readonly string[]
    draw: (input: ToolRowDraw) => RenderElement | undefined
  }
  assistantText?: {
    draw: (input: AssistantDraw) => Promise<RenderElement | undefined>
  }
}

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export const registerRender = (on: On, rules: readonly RenderRule[]): void => {
  for (const rule of rules) {
    const { toolRow, assistantText } = rule

    if (toolRow !== undefined) {
      // ToolUse carries no ctrl+o flag, so the engine's row is always kept and
      // the rule draws beside it.
      on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
        if (!toolRow.tools.includes(e.props.tool)) return next(e)
        const row = await next(e)
        try {
          return toolRow.draw({ e, row, elements: $.ui.resolve(e) }) ?? row
        } catch (error) {
          await $.ui.log(`${rule.id}: drew the engine's row, ${reason(error)}`)
          return row
        }
      })
    }

    if (assistantText !== undefined) {
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
                .catch(error => $.ui.log(`${rule.id}: the prompt did not take ${text.trim()}, ${reason(error)}`)),
          })
          return drawn ?? next(e)
        } catch (error) {
          await $.ui.log(`${rule.id}: drew the engine's text, ${reason(error)}`)
          return next(e)
        }
      })
    }
  }
}
