import { expect, test } from 'claude-code/testing'

import { parseListeners } from '../hooks/rules/port-watch'
import { SURFACES, probe } from './probe'
import type { Answer } from './probe'

const LSOF = 'lsof -nP -iTCP -sTCP:LISTEN +c 0 -F pcn'

// `lsof -nP -iTCP -sTCP:LISTEN +c 0 -F pcn` field output: the first three
// processes as this Mac printed them (rapportd lists one port on IPv4 and
// IPv6, so twice), then a node server and a name with spaces added by hand.
const LSOF_OUT = [
  'p844',
  'crapportd',
  'f10',
  'n*:55501',
  'f11',
  'n*:55501',
  'f19',
  'n*:49276',
  'p971',
  'cControlCenter',
  'f10',
  'n*:7000',
  'f12',
  'n*:5000',
  'p1028',
  'cARDAgent',
  'f10',
  'n*:3283',
  'p51234',
  'cnode',
  'f23',
  'n[::1]:3000',
  'f24',
  'n127.0.0.1:9229',
  'p40210',
  'cGoogle Chrome Helper',
  'f31',
  'n127.0.0.1:9222',
  '',
].join('\n')

const PORTS: Record<string, Answer> = { [LSOF]: { stdout: LSOF_OUT } }

test('port-watch parser: one row per process and address, newest process first', () => {
  expect(parseListeners(LSOF_OUT)).toEqual([
    { pid: 51234, command: 'node', address: '[::1]', port: 3000 },
    { pid: 51234, command: 'node', address: '127.0.0.1', port: 9229 },
    { pid: 40210, command: 'Google Chrome Helper', address: '127.0.0.1', port: 9222 },
    { pid: 1028, command: 'ARDAgent', address: '*', port: 3283 },
    { pid: 971, command: 'ControlCenter', address: '*', port: 5000 },
    { pid: 971, command: 'ControlCenter', address: '*', port: 7000 },
    { pid: 844, command: 'rapportd', address: '*', port: 49276 },
    { pid: 844, command: 'rapportd', address: '*', port: 55501 },
  ])
  expect(parseListeners('')).toEqual([])
})

test('port-watch: /ports is registered and toggles a pane that Esc closes', async ($, on) => {
  const session = probe($, on, PORTS)
  await session.start()
  expect(session.commands()).toEqual(['ports'])
  expect((await session.command('ports')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'ports', title: 'Ports', closeOnEscape: true }])
  expect((await session.command('ports')).text).toContain('closed')
  expect(session.closes()).toEqual(['ports'])
})

test('port-watch: listening ports at 72 columns on every surface', async ($, on) => {
  const session = probe($, on, PORTS)
  await session.command('ports')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'ports', 72)
    expect((await ui.find({ key: 'header' }))?.text).toBe('Ports  updated 12:34:56')
    expect(await session.lines(ui)).toEqual([
      '8 listening TCP ports, newest process first',
      'PORT   ADDRESS          PID      PROCESS',
      '3000   [::1]            51234    node',
      '9229   127.0.0.1        51234    node',
      '9222   127.0.0.1        40210    Google Chrome Helper',
      '3283   *                1028     ARDAgent',
      '5000   *                971      ControlCenter',
      '7000   *                971      ControlCenter',
      '49276  *                844      rapportd',
      '55501  *                844      rapportd',
    ])
    await ui.unmount()
  }
})

test('port-watch: refreshes every 10 seconds while open, and stops when closed', async ($, on) => {
  const session = probe($, on, PORTS)
  await session.command('ports')
  expect(session.runs()).toEqual([LSOF])
  session.answer(LSOF, { stdout: 'p51234\ncnode\nf23\nn*:8080\n' })
  await session.clock.advance(10_000)
  expect(session.runs()).toHaveLength(2)
  const ui = await session.mount('terminal', 'ports')
  expect((await session.lines(ui)).at(-1)).toBe('8080   *                51234    node')
  await ui.unmount()

  session.personClose('ports')
  await session.clock.advance(10_000)
  await session.clock.advance(60_000)
  expect(session.runs()).toHaveLength(2)
})

test('port-watch: tool calls do not run lsof', async ($, on) => {
  const session = probe($, on, PORTS)
  await session.command('ports')
  await session.clock.advance(2_000)
  await session.bash('git commit -m x')
  await session.call({ tool: 'Write', file_path: '/repo/a.ts', content: 'x' })
  expect(session.runs()).toEqual([LSOF])
})

test('port-watch: nothing listening reads as such', async ($, on) => {
  const session = probe($, on, { [LSOF]: { exitCode: 1 } })
  await session.command('ports')
  const ui = await session.mount('terminal', 'ports')
  expect(await session.lines(ui)).toEqual(['No TCP port is listening.'])
  await ui.unmount()
})

test('port-watch: where lsof is missing the pane says what it needs', async ($, on) => {
  const session = probe($, on, { [LSOF]: { reject: 'spawn lsof ENOENT' } })
  await session.command('ports')
  const ui = await session.mount('terminal', 'ports', 120)
  const [failed, needs] = await session.lines(ui)
  // The kit skips a test hook that throws, so the rejection text is its own.
  expect(failed).toMatch(/^lsof did not run: /)
  expect(needs).toBe('port-watch reads listening ports with lsof, found on macOS and most Linux systems.')
  await ui.unmount()
})

test('port-watch: an lsof error is shown', async ($, on) => {
  const session = probe($, on, { [LSOF]: { exitCode: 1, stderr: 'lsof: unsupported option: -sTCP:LISTEN\nusage' } })
  await session.command('ports')
  const ui = await session.mount('terminal', 'ports', 120)
  expect(await session.lines(ui)).toEqual(['lsof failed: lsof: unsupported option: -sTCP:LISTEN'])
  await ui.unmount()
})

test('port-watch: rows fit narrow panes on every surface', async ($, on) => {
  const session = probe($, on, PORTS)
  await session.command('ports')
  for (const surface of SURFACES) {
    for (const columns of [40, 20, 8]) {
      const ui = await session.mount(surface, 'ports', columns)
      for (const text of await session.lines(ui)) {
        expect({ surface, columns, text, fits: text.length <= columns }).toEqual({ surface, columns, text, fits: true })
      }
      await ui.unmount()
    }
  }
})

test('port-watch: a credential in a process name is redacted', async ($, on) => {
  const key = 'AKIA' + 'ABCDEFGHIJKLMNOP'
  const session = probe($, on, { [LSOF]: { stdout: `p77\ncserver-${key}\nf3\nn*:4000\n` } })
  await session.command('ports')
  const ui = await session.mount('terminal', 'ports', 120)
  const text = (await session.lines(ui)).join('\n')
  expect(text).toContain('[REDACTED]')
  expect(text).not.toContain(key)
  await ui.unmount()
})
