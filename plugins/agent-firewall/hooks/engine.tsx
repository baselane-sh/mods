import { atom, read, update } from 'claude-code'
import type { On, ToolCallEnvelope } from 'claude-code'

import type { FirewallRow } from '../types'
import { addRow, NO_CALLS, outcomeOf, statusText, summaryOf, tally } from './record'
import { paneTree } from './view'

// One summary rule: names the text that says what a call does, or leaves
// the call to the next rule (the engine falls back to the first text
// argument).
export type SummaryRule = {
  id: string
  summarize: (e: ToolCallEnvelope) => string | undefined
}

const PANE = 'firewall'
const TITLE = 'Agent Firewall'
const COMMAND = 'firewall'

const rows = atom({ plugin: 'agent-firewall', key: 'rows' } as const, [])
const counts = atom({ plugin: 'agent-firewall', key: 'counts' } as const, NO_CALLS)

const named = (rules: readonly SummaryRule[], e: ToolCallEnvelope): string | undefined => {
  for (const rule of rules) {
    try {
      const text = rule.summarize(e)
      if (text !== undefined) return text
    } catch {
      // A rule that throws leaves the call to the next one.
    }
  }
  return undefined
}

export const registerFirewall = (on: On, rules: readonly SummaryRule[]): void => {
  // Calls the permission check put to the mode's decider, by tool_use_id,
  // until their tool.call settles. Not drawn, so not kept in $.state.
  const asked = new Set<string>()

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Show or hide the Agent Firewall pane: every tool call, ran or blocked',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (isOpen) {
      await $.ui.close({ id: PANE })
      return { text: 'Agent Firewall pane closed.' }
    }
    await $.ui.open({ id: PANE, title: TITLE, closeOnEscape: true })
    return { text: 'Agent Firewall pane opened. Run /firewall again or press Esc to close it.' }
  })

  // tool.check fires inside the call, after the PreToolUse hooks, and its
  // verdict carries their decision. `ask` there means the call goes to the
  // mode's decider: the dialog, the auto-mode classifier or a headless host.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (e.tool_use_id !== undefined && verdict.decision === 'ask') asked.add(e.tool_use_id)
    return verdict
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const wasAsked = asked.delete(e.tool_use_id)
    try {
      const row: FirewallRow = {
        id: e.tool_use_id,
        at: await $.clock.now(),
        tool: e.tool,
        summary: summaryOf(named(rules, e), e),
        outcome: outcomeOf(ran, wasAsked),
      }
      await update($, rows, list => addRow(list, row))
      const total = await update($, counts, now => tally(now, row.outcome))
      $.ui.status(statusText(total))
    } catch (error) {
      await $.ui.log(`agent-firewall: a call was not recorded, ${error instanceof Error ? error.message : String(error)}`)
    }
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return paneTree({ Box, Text }, await read($, rows), await read($, counts), e.props.bodyColumns)
  })
}
