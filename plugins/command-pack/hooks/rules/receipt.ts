import type { CommandRecord } from '../../types'
import type { CommandRule, Facts } from '../engine'

const WIDTH = 35 // the signature line is the widest line
const SIGNATURE = 'made with Claude Code + baselane.sh'
const TOP_TOOLS = 4

const row = (label: string, value: string): string => `${label}${' '.repeat(Math.max(1, WIDTH - label.length - value.length))}${value}`
const center = (text: string): string => `${' '.repeat(Math.floor((WIDTH - text.length) / 2))}${text}`.padEnd(WIDTH)
const bar = (char: string): string => char.repeat(WIDTH)

export const duration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

const toolRows = (tools: CommandRecord['tools']): string[] => {
  const ranked = Object.entries(tools).sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
  const top = ranked.slice(0, TOP_TOOLS)
  const rest = ranked.slice(TOP_TOOLS)
  const rows = top.map(([name, count]) => row(`  ${name}`, String(count)))
  if (rest.length === 0) return rows
  const total = rest.reduce((sum, [, count]) => sum + count, 0)
  return [...rows, row(`  other (${rest.length} tools)`, String(total))]
}

const compose = (record: CommandRecord, facts: Facts): string =>
  [
    bar('='),
    center('SESSION RECEIPT'),
    bar('='),
    row('session length', facts.elapsedMs === undefined ? 'n/a' : duration(facts.elapsedMs)),
    row('turns', facts.turns === undefined ? 'n/a' : String(facts.turns)),
    bar('-'),
    row('TOOL CALLS', String(record.calls)),
    ...toolRows(record.tools),
    bar('-'),
    row('files touched', String(record.files.length)),
    row('commands run', String(record.commandsRun)),
    row('blocked', String(record.blocked)),
    row('errors', String(record.errored)),
    bar('-'),
    row('context used', facts.contextPercent === undefined ? 'n/a' : `${Math.round(facts.contextPercent)}%`),
    row('cost', facts.costUsd === undefined ? 'n/a' : `$${facts.costUsd.toFixed(2)}`),
    bar('='),
    SIGNATURE,
  ].join('\n')

export const rule: CommandRule = {
  name: 'receipt',
  description: 'Print a shareable receipt of this session and copy it',
  compose,
}
