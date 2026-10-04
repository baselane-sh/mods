import type { ProcessRunResult } from 'claude-code'

import type { PaneLine } from '../../types'
import { clean, line } from '../lines'
import type { PaneRule } from '../rule'

// The local TCP ports that listen, read with lsof in field mode: `-F pcn`
// gives one field a line (p pid, c command, n address), so a command name
// with spaces stays whole, and `+c 0` keeps it uncut. lsof is on macOS and
// most Linux systems; elsewhere it does not start and the pane says so. On
// Linux, lsof run without root lists only the person's own processes.
const LSOF = ['lsof', '-nP', '-iTCP', '-sTCP:LISTEN', '+c', '0', '-F', 'pcn']

const PORT_WIDTH = 7
const ADDRESS_WIDTH = 17
const PID_WIDTH = 9

export type Listener = { pid: number; command: string; address: string; port: number }

// One row per process and address (lsof lists an IPv4 and an IPv6 socket on
// the same port twice), newest process (highest pid) first, then by port.
export const parseListeners = (stdout: string): Listener[] => {
  const rows: Listener[] = []
  const seen = new Set<string>()
  let pid = 0
  let command = ''
  for (const text of stdout.split('\n')) {
    const field = text[0]
    const value = text.slice(1)
    if (field === 'p') {
      pid = Number(value)
      command = ''
    } else if (field === 'c') {
      command = value
    } else if (field === 'n') {
      const colon = value.lastIndexOf(':')
      const port = Number(value.slice(colon + 1))
      if (colon < 0 || !Number.isInteger(port)) continue
      const address = value.slice(0, colon)
      const id = `${pid} ${address} ${port}`
      if (seen.has(id)) continue
      seen.add(id)
      rows.push({ pid, command, address, port })
    }
  }
  return [...rows].sort((a, b) => b.pid - a.pid || a.port - b.port)
}

const column = (text: string, width: number): string => text.padEnd(width)

const listenerLines = (listeners: readonly Listener[]): PaneLine[] => [
  line('count', { text: `${listeners.length} listening TCP ${listeners.length === 1 ? 'port' : 'ports'}, newest process first`, bold: true }),
  line(
    'head',
    { text: column('PORT', PORT_WIDTH), dim: true },
    { text: column('ADDRESS', ADDRESS_WIDTH), dim: true },
    { text: column('PID', PID_WIDTH), dim: true },
    { text: 'PROCESS', dim: true },
  ),
  ...listeners.map(row =>
    line(
      `port-${row.pid}-${row.address}-${row.port}`,
      { text: column(String(row.port), PORT_WIDTH), color: 'cyan', bold: true },
      { text: column(row.address, ADDRESS_WIDTH), ...(row.address === '*' ? { color: 'yellow' } : {}) },
      { text: column(String(row.pid), PID_WIDTH), dim: true },
      { text: clean(row.command) },
    ),
  ),
]

const firstLine = (text: string): string => text.split('\n').find(each => each.trim().length > 0)?.trim() ?? ''

export const rule: PaneRule = {
  id: 'port-watch',
  pane: {
    id: 'ports',
    title: 'Ports',
    command: 'ports',
    description: 'Show or hide the Ports pane: local TCP ports that listen, with process and pid',
    empty: 'Reading listening ports…',
  },
  everyMs: 10_000,
  load: async host => {
    let ran: ProcessRunResult
    try {
      ran = await host.run(LSOF)
    } catch (error) {
      return [
        line('failed', { text: `lsof did not run: ${error instanceof Error ? error.message : String(error)}`, color: 'red' }),
        line('needs', { text: 'port-watch reads listening ports with lsof, found on macOS and most Linux systems.', dim: true }),
      ]
    }
    const listeners = parseListeners(ran.stdout)
    if (listeners.length > 0) return listenerLines(listeners)
    // lsof exits 1 with no output when nothing matches.
    const reason = firstLine(ran.stderr)
    if (reason.length > 0) return [line('failed', { text: `lsof failed: ${reason}`, color: 'red' })]
    return [line('none', { text: 'No TCP port is listening.', dim: true })]
  },
}
