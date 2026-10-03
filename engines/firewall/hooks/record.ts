import type { ToolCallEnvelope, ToolCallResult } from 'claude-code'

import type { FirewallCounts, FirewallOutcome, FirewallRow } from '../types'
import { redact } from './patterns'

// Rows kept for the pane. More than a docked pane shows floor to ceiling on
// a tall terminal (about 60), and small enough that the copy each call's
// state write makes stays a few kilobytes. The counters are not capped.
export const MAX_ROWS = 100

export const NO_CALLS: FirewallCounts = { calls: 0, ran: 0, asked: 0, blocked: 0, errors: 0 }

// A summary is cut to the pane's width when drawn; this only bounds what a
// row keeps.
const MAX_SUMMARY = 500

const RESERVED = new Set(['tool', 'tool_use_id', 'agentId'])

// A refusal wins, then an ask (the call was put to the mode's decider and
// went on), then the tool's own error.
export const outcomeOf = (ran: ToolCallResult, wasAsked: boolean): FirewallOutcome => {
  if (ran.deny !== undefined) return 'blocked'
  if (wasAsked) return 'asked'
  return ran.isError === true ? 'error' : 'ran'
}

const firstText = (e: ToolCallEnvelope): string => {
  const entry = Object.entries(e).find(([key, value]) => !RESERVED.has(key) && typeof value === 'string')
  return entry === undefined ? '' : String(entry[1])
}

// Redacted on the whole line, before any cut: a credential cut short no
// longer matches its shape and would slip through.
export const summaryOf = (named: string | undefined, e: ToolCallEnvelope): string =>
  redact((named ?? firstText(e)).replace(/\s+/g, ' ').trim()).slice(0, MAX_SUMMARY)

export const addRow = (rows: readonly FirewallRow[], row: FirewallRow): FirewallRow[] =>
  [row, ...rows].slice(0, MAX_ROWS)

const COUNTER: Readonly<Record<FirewallOutcome, keyof FirewallCounts>> = {
  ran: 'ran',
  asked: 'asked',
  blocked: 'blocked',
  error: 'errors',
}

export const tally = (counts: FirewallCounts, outcome: FirewallOutcome): FirewallCounts => ({
  ...counts,
  calls: counts.calls + 1,
  [COUNTER[outcome]]: counts[COUNTER[outcome]] + 1,
})

export const statusText = (counts: FirewallCounts): string =>
  `firewall: ${counts.calls} calls, ${counts.blocked} blocked`
