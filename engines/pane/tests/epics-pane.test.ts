import { expect, test } from 'claude-code/testing'

import { barCells, byPriorityThenDone, epicsOf } from '../hooks/rules/epics-pane'
import { CWD, SURFACES, probe } from './probe'
import type { Answer } from './probe'

const EPIC_STATUS = `bd -C ${CWD} --readonly epic status --json`

// The shape bd 1.2.2 prints for `bd epic status --json` (keys as a real repo
// shows them; texts made up, descriptions cut).
const entry = (id: string, priority: number, closed: number, total: number, title: string, eligible = false, status = 'open') => ({
  epic: {
    id,
    title,
    description: '…',
    status,
    priority,
    issue_type: 'epic',
    owner: 'me@example.com',
    created_at: '2026-08-23T22:32:40Z',
    created_by: 'Me',
    updated_at: '2026-08-23T22:32:40Z',
    labels: ['goal'],
  },
  total_children: total,
  closed_children: closed,
  eligible_for_close: eligible,
})

const EPICS = [
  entry('bm-ooq', 2, 60, 80, 'Post approval'),
  entry('bm-1fp', 1, 7, 8, 'The audit deliverable is trustworthy'),
  entry('bm-lwgso', 1, 5, 75, 'Gap review'),
  entry('bm-zwf', 1, 22, 22, 'Onboarding works end to end', true),
  entry('bm-gone', 0, 3, 3, 'Closed already', false, 'closed'),
]

const json = (value: unknown): Answer => ({ stdout: JSON.stringify(value, null, 2) })

const WORLD: Record<string, Answer> = { [EPIC_STATUS]: json(EPICS) }

test('epics-pane parser: open epics only, by priority then nearest to done', () => {
  const epics = epicsOf(EPICS) ?? []
  expect([...epics].sort(byPriorityThenDone).map(epic => epic.id)).toEqual(['bm-zwf', 'bm-1fp', 'bm-lwgso', 'bm-ooq'])
  expect(epicsOf(null)).toEqual([])
  expect(epicsOf({ epic: {} })).toBeUndefined()
  expect(epicsOf([{ total_children: 3 }, { epic: { id: 'a', title: 't' } }, 'x'])).toEqual([])
})

test('epics-pane parser: the bar fills only when every child is closed', () => {
  expect(barCells(7, 8)).toBe(7)
  expect(barCells(79, 80)).toBe(7)
  expect(barCells(80, 80)).toBe(8)
  expect(barCells(0, 0)).toBe(0)
  expect(barCells(1, 75)).toBe(0)
})

test('epics-pane: /epics is registered and toggles a pane that Esc closes', async ($, on) => {
  const session = probe($, on, WORLD)
  await session.start()
  expect(session.commands()).toEqual(['epics'])
  expect((await session.command('epics')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'epics', title: 'Epics', closeOnEscape: true }])
  expect((await session.command('epics')).text).toContain('closed')
  expect(session.closes()).toEqual(['epics'])
})

test('epics-pane: id, bar, closed of total, the ready mark and title, on every surface', async ($, on) => {
  const session = probe($, on, WORLD)
  await session.command('epics')
  expect(session.runs()).toEqual([EPIC_STATUS])
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'epics', 100)
    expect(await session.lines(ui)).toEqual([
      '4 open epics, 1 ready to close',
      'bm-zwf    ████████  22/22  ready to close  Onboarding works end to end',
      'bm-1fp    ███████░    7/8  The audit deliverable is trustworthy',
      'bm-lwgso  ░░░░░░░░   5/75  Gap review',
      'bm-ooq    ██████░░  60/80  Post approval',
    ])
    await ui.unmount()
  }
})

test('epics-pane: the bar and the ready mark carry color, and the text says it without', async ($, on) => {
  const session = probe($, on, WORLD)
  await session.command('epics')
  const ui = await session.mount('terminal', 'epics', 100)
  const texts = await ui.findAll({ type: 'Text' })
  const bar = texts.find(text => text.text === '████████')
  const mark = texts.find(text => text.text === '  ready to close')
  expect(bar?.props.color).toBe('green')
  expect(mark?.props.color).toBe('green')
  await ui.unmount()
})

test('epics-pane: no open epic reads as such', async ($, on) => {
  const session = probe($, on, { [EPIC_STATUS]: { stdout: '[]\n' } })
  await session.command('epics')
  const ui = await session.mount('terminal', 'epics', 100)
  expect(await session.lines(ui)).toEqual(['No open epics.'])
  await ui.unmount()
})

test('epics-pane: outside a beads project, without bd, or when bd fails, one line says so', async ($, on) => {
  const cases: [Answer, string][] = [
    [{ exitCode: 1, stderr: 'Error: no beads database found\nHint: run bd init' }, 'No beads project in this folder.'],
    [{ reject: 'spawn bd ENOENT' }, 'bd is not installed.'],
    [{ exitCode: 1, stderr: 'Error: database is locked by /private/secret/path' }, 'bd did not answer.'],
    [{ stdout: '' }, 'bd did not answer.'],
    [{ stdout: '[{"epic": ' }, 'bd did not answer.'],
    [{ stdout: '{"schema_version":1}' }, 'bd did not answer.'],
  ]
  const session = probe($, on, WORLD)
  for (const [answer, said] of cases) {
    session.answer(EPIC_STATUS, answer)
    await session.command('epics')
    const ui = await session.mount('terminal', 'epics', 100)
    expect(await session.lines(ui)).toEqual([said])
    await ui.unmount()
    await session.command('epics')
    await session.clock.advance(10_000)
  }
  expect(session.logs()).toEqual([])
})

test('epics-pane: refreshes after a Bash call at most once every 10 seconds, and not after other tools', async ($, on) => {
  const session = probe($, on, WORLD)
  const loads = () => session.runs().length
  await session.command('epics')
  expect(loads()).toBe(1)
  await session.bash('bd close bm-1fp.8')
  await session.bash('bd ready')
  await session.clock.advance(9_000)
  expect(loads()).toBe(1)
  await session.clock.advance(1_000)
  expect(loads()).toBe(2)
  await session.clock.advance(20_000)
  await session.call({ tool: 'Read', file_path: `${CWD}/a.ts` })
  expect(loads()).toBe(2)
  await session.bash('bd ready')
  expect(loads()).toBe(3)
  session.personClose('epics')
  await session.bash('bd ready')
  await session.clock.advance(60_000)
  expect(loads()).toBe(3)
})

test('epics-pane: color codes and tabs in a title are cleaned out', async ($, on) => {
  const session = probe($, on, { [EPIC_STATUS]: json([entry('bm-1fp', 1, 7, 8, 'Ship\u001b[31m it\tnow\u001b[0m')]) })
  await session.command('epics')
  const ui = await session.mount('terminal', 'epics', 100)
  expect((await session.lines(ui))[1]).toBe('bm-1fp  ███████░  7/8  Ship it now')
  await ui.unmount()
})

test('epics-pane: a long title is cut to fit, on every surface', async ($, on) => {
  const long = `Ship ${'every '.repeat(40)}thing\u001b[31m now`
  const session = probe($, on, { [EPIC_STATUS]: json([entry('bm-1fp', 1, 7, 8, long)]) })
  await session.command('epics')
  for (const surface of SURFACES) {
    for (const columns of [100, 40]) {
      const ui = await session.mount(surface, 'epics', columns)
      const row = (await session.lines(ui))[1] ?? ''
      expect(row.length).toBe(columns)
      expect(row.startsWith('bm-1fp  ███████░  7/8  Ship every')).toBe(true)
      expect(row.endsWith('…')).toBe(true)
      expect(/[\u0000-\u001f]/.test(row)).toBe(false)
      await ui.unmount()
    }
  }
})
