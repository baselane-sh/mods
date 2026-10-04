import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

const SCRIPT = ['-e', 'on run argv', '-e', 'display notification (item 1 of argv) with title (item 2 of argv)', '-e', 'end run']

const programs = (started: readonly (readonly string[])[]) => started.filter(argv => argv[0] !== 'uname' && argv[0] !== 'which')

test('desktop-notify: on macOS runs osascript with the text as argv elements', async ($, on) => {
  const session = probe($, on, { uname: 'Darwin' })
  await session.needsInput('/work/myproj')
  expect(programs(session.started())).toEqual([['osascript', ...SCRIPT, '--', 'Needs your input (myproj)', 'Claude Code']])
})

test('desktop-notify: a hostile folder name never reaches the script source', async ($, on) => {
  const session = probe($, on, { uname: 'Darwin' })
  const hostile = '/work/x" & (do shell script "touch pwned") & "'
  await session.needsInput(hostile)
  const argv = programs(session.started())[0] ?? []
  const source = argv.slice(0, argv.indexOf('--'))
  expect(source).toEqual(['osascript', ...SCRIPT])
  expect(argv.at(-2)).toBe('Needs your input (x" & (do shell script "touch pwned") & ")')
})

test('desktop-notify: elsewhere uses notify-send when it is on PATH', async ($, on) => {
  const session = probe($, on, { uname: 'Linux', onPath: { 'notify-send': '/usr/bin/notify-send' } })
  await session.needsInput('/work/myproj')
  expect(programs(session.started())).toEqual([['notify-send', '--', 'Claude Code', 'Needs your input (myproj)']])
})

test('desktop-notify: no notify-send, nothing runs', async ($, on) => {
  const session = probe($, on, { uname: 'Linux' })
  await session.needsInput()
  expect(programs(session.started())).toEqual([])
  expect(session.logs()).toEqual([])
})

test('desktop-notify: without uname or which (Windows) it stays quiet', async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(programs(session.started())).toEqual([])
  expect(session.logs()).toEqual([])
})

test('desktop-notify: the text never carries the notification message', async ($, on) => {
  const session = probe($, on, { uname: 'Darwin' })
  await session.needsInput()
  expect(JSON.stringify(session.started())).not.toContain('permission to use Bash')
})

test('desktop-notify: a failed osascript is logged and the notification goes on', async ($, on) => {
  const session = probe($, on, { uname: 'Darwin', format: () => ({ exitCode: 1 }) })
  await session.needsInput()
  expect(session.logs()).toEqual(['desktop-notify: skipped, osascript exited 1'])
})

test('desktop-notify: sends nothing over the network', async ($, on) => {
  const session = probe($, on, { uname: 'Darwin' })
  await session.needsInput()
  expect(session.fetched()).toEqual([])
})
