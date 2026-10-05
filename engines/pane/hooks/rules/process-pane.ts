import type { ProcessRunResult, ToolCallEnvelope } from 'claude-code'

import type { PaneLine } from '../../types'
import { clean, line } from '../lines'
import { redact } from '../patterns'
import type { PaneRule } from '../rule'

// The processes the session's Bash calls started that still run. Claude Code
// runs each Bash call in a shell of its own, a child of the Claude process,
// whose command names its shell snapshot; every descendant of such a shell is
// one of this session's. Read with one `ps` (POSIX fields, -ww for whole
// command lines); this rule never signals or changes a process.
export const PS = ['ps', '-A', '-ww', '-o', 'pid=,ppid=,etime=,args=']
const SHELL_MARK = 'shell-snapshots/snapshot-'
// How far above ps's parent the Claude process may sit (a plugin host between).
const MAX_HOPS = 3
const MAX_ROWS = 20
const MAX_COMMAND = 60
const PID_WIDTH = 8
const AGE_WIDTH = 11

export type PsRow = { pid: number; ppid: number; seconds: number; args: string }

// `[[dd-]hh:]mm:ss`, as ps prints the elapsed time.
export const secondsOf = (etime: string): number | undefined => {
  const found = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(etime)
  if (found === null) return undefined
  const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = found
  return ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 + Number(seconds)
}

export const ageText = (seconds: number): string => {
  if (seconds < 60) return `${seconds} s`
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} min`
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} h ${Math.floor((seconds % 3_600) / 60)} min`
  return `${Math.floor(seconds / 86_400)} d ${Math.floor((seconds % 86_400) / 3_600)} h`
}

export const parsePs = (stdout: string): PsRow[] =>
  stdout.split('\n').flatMap(text => {
    const found = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(text)
    const seconds = found === null ? undefined : secondsOf(found[3] ?? '')
    if (found === null || seconds === undefined) return []
    return [{ pid: Number(found[1]), ppid: Number(found[2]), seconds, args: found[4] ?? '' }]
  })

const isShell = (row: PsRow): boolean => row.args.includes(SHELL_MARK)

// Every descendant of `roots`, the roots left out.
const descendants = (rows: readonly PsRow[], roots: readonly number[]): PsRow[] => {
  const found: PsRow[] = []
  let frontier = new Set(roots)
  while (frontier.size > 0) {
    const children = rows.filter(row => frontier.has(row.ppid) && !found.includes(row))
    found.push(...children)
    frontier = new Set(children.map(row => row.pid))
  }
  return found
}

// The Bash calls' processes, newest first. The Claude process is the nearest
// ancestor of this ps (its own row, found by its command) with Bash shells
// for children.
export const bashProcesses = (rows: readonly PsRow[], psCommand: string): PsRow[] => {
  const self = rows.find(row => row.args === psCommand)
  let host = self?.ppid
  for (let hop = 0; host !== undefined && hop < MAX_HOPS; hop += 1) {
    const at = host
    const shells = rows.filter(row => row.ppid === at && isShell(row))
    if (shells.length > 0) {
      return descendants(
        rows,
        shells.map(row => row.pid),
      ).sort((a, b) => a.seconds - b.seconds || b.pid - a.pid)
    }
    host = rows.find(row => row.pid === at)?.ppid
  }
  return []
}

// Redacted before the cut: a credential cut short no longer matches its shape.
const commandText = (args: string): string => {
  const text = clean(redact(args))
  return text.length <= MAX_COMMAND ? text : `${text.slice(0, MAX_COMMAND - 1)}…`
}

const processLines = (rows: readonly PsRow[]): PaneLine[] => {
  const rest = rows.length - MAX_ROWS
  return [
    line('count', { text: `${rows.length} ${rows.length === 1 ? 'process' : 'processes'} from Bash calls still run, newest first`, bold: true }),
    line('head', { text: 'PID'.padEnd(PID_WIDTH), dim: true }, { text: 'AGE'.padEnd(AGE_WIDTH), dim: true }, { text: 'COMMAND', dim: true }),
    ...rows
      .slice(0, MAX_ROWS)
      .map(row =>
        line(
          `pid-${row.pid}`,
          { text: String(row.pid).padEnd(PID_WIDTH), color: 'cyan', bold: true },
          { text: ageText(row.seconds).padEnd(AGE_WIDTH), dim: true },
          { text: commandText(row.args) },
        ),
      ),
    ...(rest > 0 ? [line('more', { text: `… and ${rest} more`, dim: true })] : []),
  ]
}

const firstLine = (text: string): string => text.split('\n').find(each => each.trim().length > 0)?.trim() ?? ''

export const rule: PaneRule = {
  id: 'process-pane',
  pane: {
    id: 'procs',
    title: 'Processes',
    command: 'procs',
    description: "Show or hide the Processes pane: processes the session's Bash calls started that still run",
    empty: 'Reading processes…',
  },
  everyMs: 5_000,
  refreshAfter: (e: ToolCallEnvelope) => e.tool === 'Bash',
  load: async host => {
    let ran: ProcessRunResult
    try {
      ran = await host.run(PS)
    } catch (error) {
      return [line('failed', { text: `ps did not run: ${error instanceof Error ? error.message : String(error)}`, color: 'red' })]
    }
    const rows = parsePs(ran.stdout)
    if (rows.length === 0 && ran.exitCode !== 0) return [line('failed', { text: `ps failed: ${firstLine(ran.stderr)}`, color: 'red' })]
    const running = bashProcesses(rows, PS.join(' '))
    if (running.length === 0) return [line('none', { text: 'No process started by a Bash call still runs.', dim: true })]
    return processLines(running)
  },
}
