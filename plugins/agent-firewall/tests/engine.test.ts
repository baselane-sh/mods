import { expect, test } from 'claude-code/testing'

import { MAX_ROWS } from '../hooks/record'
import { probe } from './probe'

// Spliced so this file does not match the shape it carries.
const FAKE_KEY = 'sk-ant-' + 'api03-abcdefghijklmnopqrstuvwxyz'

const rowText = async (ui: Awaited<ReturnType<ReturnType<typeof probe>['mount']>>, id?: string) =>
  (await ui.findAll({ type: 'Box' })).filter(box => box.key?.startsWith(id === undefined ? 'row-' : `row-${id}`))

test('firewall: each outcome is counted and the counters add up', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  await session.bash('npm test')
  await session.bash('rm -rf /', 'blocked')
  await session.bash('git push', 'asked')
  await session.bash('false', 'error')

  const ui = await session.mount('terminal')
  const counter = async (key: string) => (await ui.find({ key }))?.text
  expect(await counter('count-calls')).toBe('5 calls')
  expect(await counter('count-ran')).toBe('2 ran')
  expect(await counter('count-asked')).toBe('1 asked')
  expect(await counter('count-blocked')).toBe('1 blocked')
  expect(await counter('count-errors')).toBe('1 errors')
  await ui.unmount()
})

test('firewall: a call passes through unchanged', async ($, on) => {
  const session = probe($, on)
  expect(await session.bash('rm -rf /', 'blocked')).toEqual({ deny: 'blocked by a rule' })
  expect((await session.bash('false', 'error')).isError).toBe(true)
  expect((await session.bash('ls')).deny).toBeUndefined()
})

test('firewall: rows are newest first and name the outcome in words', async ($, on) => {
  const session = probe($, on)
  await session.bash('echo first')
  await session.bash('rm -rf /', 'blocked')
  await session.bash('git push', 'asked')
  await session.bash('false', 'error')

  const ui = await session.mount('terminal', 100)
  const rows = await rowText(ui)
  expect(rows.map(row => row.text.replace(/^\d\d:\d\d:\d\d /, '').replace(/\s+/g, ' ').trim())).toEqual([
    '! error Bash false',
    '? asked Bash git push',
    '✘ blocked Bash rm -rf /',
    '✔ ran Bash echo first',
  ])
  await ui.unmount()
})

test('firewall: credentials are redacted before the row is kept', async ($, on) => {
  const session = probe($, on)
  await session.bash(`curl -H "x-api-key: ${FAKE_KEY}" https://api.example.com`)

  const ui = await session.mount('terminal', 200)
  const [row] = await rowText(ui)
  expect(row?.text).toContain('[REDACTED]')
  expect(row?.text).not.toContain(FAKE_KEY.slice(0, 12))
  await ui.unmount()
})

test('firewall: only the newest rows are kept, the counters keep the total', async ($, on) => {
  const session = probe($, on)
  for (let n = 1; n <= MAX_ROWS + 5; n += 1) await session.bash(`echo ${n}`)

  const ui = await session.mount('terminal', 100)
  const rows = await rowText(ui)
  expect(rows).toHaveLength(MAX_ROWS)
  expect(rows[0]?.text).toContain(`echo ${MAX_ROWS + 5}`)
  expect((await ui.find({ key: 'count-calls' }))?.text).toBe(`${MAX_ROWS + 5} calls`)
  await ui.unmount()
})

test('firewall: the status line carries the short count', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  await session.bash('rm -rf /', 'blocked')
  expect(session.statuses().at(-1)).toBe('firewall: 2 calls, 1 blocked')
})

test('firewall: /firewall is registered at session start', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.commands()).toEqual(['firewall'])
})

test('firewall: /firewall opens the pane, Esc can close it, and /firewall again closes it', async ($, on) => {
  const session = probe($, on)
  const opened = await session.command()
  expect(opened.text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'firewall', title: 'Agent Firewall', closeOnEscape: true }])

  const closed = await session.command()
  expect(closed.text).toContain('closed')
  expect(session.closes()).toEqual(['firewall'])
})

test('firewall: a tool no rule knows shows its first text argument', async ($, on) => {
  const session = probe($, on)
  await session.call({ tool: 'WebSearch', query: 'claude code plugins', mode: 'standard' })
  const ui = await session.mount('terminal', 100)
  expect((await rowText(ui))[0]?.text).toContain('WebSearch')
  expect((await rowText(ui))[0]?.text).toContain('claude code plugins')
  await ui.unmount()
})
