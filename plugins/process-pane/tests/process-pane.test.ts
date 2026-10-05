import { expect, test } from 'claude-code/testing'

import { ageText, bashProcesses, parsePs, secondsOf } from '../hooks/rules/process-pane'
import { SURFACES, probe } from './probe'
import type { Answer } from './probe'

const PS = 'ps -A -ww -o pid=,ppid=,etime=,args='

// The shell Claude Code's Bash tool starts for each call, as this Mac shows it.
const shell = (command: string) =>
  `/bin/zsh -c source /Users/me/.claude/shell-snapshots/snapshot-zsh-1791.sh 2>/dev/null || true && eval '${command}' < /dev/null && pwd -P >| /tmp/claude-1-cwd`

const ESBUILD = '/repo/node_modules/@esbuild/darwin-arm64/bin/esbuild --service=0.21.5 --ping'

// Claude (900) runs two Bash shells, an MCP server and the plugin's own ps.
// The orphan python server and the MCP server's child are not the session's
// Bash calls.
const PS_OUT = [
  '    1     0 05-01:00:00 /sbin/launchd',
  '  900     1  1:00:00 /Users/me/.local/bin/claude --session-id abc',
  `  910   900    59:00 ${shell('npm run dev')}`,
  '  911   910    58:59 node /repo/node_modules/.bin/vite --port 5173',
  `  912   911    58:58 ${ESBUILD}`,
  `  920   900    00:05 ${shell('sleep 30')}`,
  '  921   920    00:05 sleep 30',
  '  930   900  2:00:00 node /Users/me/.npm/_npx/mcp-server/index.js',
  '  931   930  2:00:00 node /Users/me/.npm/_npx/mcp-server/worker.js',
  `  950   900    00:00 ${PS}`,
  '  960     1    10:00 /usr/bin/python3 -m http.server',
  '',
].join('\n')

const WORLD: Record<string, Answer> = { [PS]: { stdout: PS_OUT } }

test('process-pane parser: elapsed times read in seconds and ages in words', () => {
  expect(secondsOf('00:05')).toBe(5)
  expect(secondsOf('59:00')).toBe(3_540)
  expect(secondsOf('1:00:00')).toBe(3_600)
  expect(secondsOf('05-01:00:00')).toBe(435_600)
  expect(secondsOf('junk')).toBeUndefined()
  expect(ageText(5)).toBe('5 s')
  expect(ageText(3_540)).toBe('59 min')
  expect(ageText(3_900)).toBe('1 h 5 min')
  expect(ageText(435_600)).toBe('5 d 1 h')
})

test('process-pane parser: only descendants of the Bash shells under this session count, newest first', () => {
  const rows = parsePs(PS_OUT)
  expect(rows).toHaveLength(11)
  expect(bashProcesses(rows, PS).map(row => row.pid)).toEqual([921, 912, 911])
})

test('process-pane parser: a plugin host one level below Claude still finds the shells', () => {
  const nested = [
    '  900     1  1:00:00 claude',
    '  905   900  1:00:00 plugin-host',
    `  910   900    01:00 ${shell('tail -f log')}`,
    '  911   910    01:00 tail -f log',
    `  950   905    00:00 ${PS}`,
  ].join('\n')
  expect(bashProcesses(parsePs(nested), PS).map(row => row.pid)).toEqual([911])
})

test('process-pane: /procs is registered and toggles a pane that Esc closes', async ($, on) => {
  const session = probe($, on, WORLD)
  await session.start()
  expect(session.commands()).toEqual(['procs'])
  expect((await session.command('procs')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'procs', title: 'Processes', closeOnEscape: true }])
  expect((await session.command('procs')).text).toContain('closed')
  expect(session.closes()).toEqual(['procs'])
})

test('process-pane: pid, age and command cut to 60 characters, on every surface', async ($, on) => {
  const session = probe($, on, WORLD)
  await session.command('procs')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'procs', 100)
    expect(await session.lines(ui)).toEqual([
      '3 processes from Bash calls still run, newest first',
      'PID     AGE        COMMAND',
      '921     5 s        sleep 30',
      '912     58 min     /repo/node_modules/@esbuild/darwin-arm64/bin/esbuild --serv…',
      '911     58 min     node /repo/node_modules/.bin/vite --port 5173',
    ])
    await ui.unmount()
  }
})

test('process-pane: only ps runs, read-only, and it refreshes every 5 seconds and after Bash calls', async ($, on) => {
  const session = probe($, on, WORLD)
  await session.command('procs')
  expect(session.runs()).toEqual([PS])
  await session.clock.advance(5_000)
  expect(session.runs()).toEqual([PS, PS])
  await session.clock.advance(2_000)
  await session.bash('npm run build')
  expect(session.runs()).toEqual([PS, PS, PS])
  await session.call({ tool: 'Read', file_path: '/repo/a.ts' })
  expect(session.runs()).toHaveLength(3)
  session.personClose('procs')
  await session.clock.advance(60_000)
  expect(session.runs()).toHaveLength(3)
})

test('process-pane: nothing left running reads as such', async ($, on) => {
  const quiet = ['  900     1  1:00:00 claude', `  950   900    00:00 ${PS}`, '  960     1    10:00 /usr/bin/python3 -m http.server'].join('\n')
  const session = probe($, on, { [PS]: { stdout: quiet } })
  await session.command('procs')
  const ui = await session.mount('terminal', 'procs', 100)
  expect(await session.lines(ui)).toEqual(['No process started by a Bash call still runs.'])
  await ui.unmount()
})

test('process-pane: at most 20 rows, then a count of the rest', async ($, on) => {
  const children = Array.from({ length: 23 }, (_, i) => `  ${2000 + i}   910    00:${String(10 + i).padStart(2, '0')} worker ${i}`)
  const out = ['  900     1  1:00:00 claude', `  910   900    01:00 ${shell('make -j')}`, ...children, `  950   900    00:00 ${PS}`].join('\n')
  const session = probe($, on, { [PS]: { stdout: out } })
  await session.command('procs')
  const ui = await session.mount('terminal', 'procs', 100)
  const lines = await session.lines(ui)
  expect(lines[0]).toBe('23 processes from Bash calls still run, newest first')
  expect(lines.filter(text => /^\d+ +\d/.test(text))).toHaveLength(20)
  expect(lines.at(-1)).toBe('… and 3 more')
  await ui.unmount()
})

test('process-pane: where ps does not start, or fails, the pane says so', async ($, on) => {
  const session = probe($, on, { [PS]: { reject: 'spawn ps ENOENT' } })
  await session.command('procs')
  const ui = await session.mount('terminal', 'procs', 100)
  expect((await session.lines(ui))[0]).toMatch(/^ps did not run: /)
  await ui.unmount()

  session.answer(PS, { exitCode: 1, stderr: 'ps: illegal option -- w\nusage: ps' })
  await session.clock.advance(5_000)
  const failed = await session.mount('terminal', 'procs', 100)
  expect(await session.lines(failed)).toEqual(['ps failed: ps: illegal option -- w'])
  await failed.unmount()
})

test('process-pane: rows fit narrow panes and a credential in a command line is redacted', async ($, on) => {
  const key = 'sk-ant-' + 'api03-abcdefghijklmnopqrstuvwxyz'
  const out = ['  900     1  1:00:00 claude', `  910   900    01:00 ${shell('serve')}`, `  911   910    01:00 serve --token ${key}`, `  950   900    00:00 ${PS}`].join(
    '\n',
  )
  const session = probe($, on, { [PS]: { stdout: out } })
  await session.command('procs')
  for (const surface of SURFACES) {
    for (const columns of [120, 30, 8]) {
      const ui = await session.mount(surface, 'procs', columns)
      const lines = await session.lines(ui)
      for (const text of lines) expect({ surface, columns, text, fits: text.length <= columns }).toEqual({ surface, columns, text, fits: true })
      expect(lines.join('\n')).not.toContain(key.slice(0, 12))
      if (columns === 120) expect(lines.join('\n')).toContain('[REDACTED]')
      await ui.unmount()
    }
  }
})
