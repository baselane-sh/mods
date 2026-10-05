import { expect, test } from 'claude-code/testing'

import { beadsOf, byPriority, rejectText } from '../hooks/beads'
import { CWD, SURFACES, probe } from './probe'
import type { Answer } from './probe'

const bd = (args: string) => `bd -C ${CWD} --readonly ${args} --json`
const IN_PROGRESS = bd('list --status in_progress --limit 0')
const READY = bd('ready --limit 0')
const BLOCKED = bd('blocked')

// The shapes bd 1.2.2 prints (keys as a real repo shows them; texts made up,
// descriptions cut).
const listed = (id: string, priority: number, createdAt: string, title: string, status = 'open') => ({
  id,
  title,
  description: '…',
  status,
  priority,
  issue_type: 'task',
  owner: 'me@example.com',
  created_at: createdAt,
  created_by: 'Me',
  updated_at: createdAt,
  labels: ['goal'],
  dependencies: [{ issue_id: id, depends_on_id: 'bm-ooq', type: 'parent-child', created_at: createdAt, created_by: 'Me', metadata: '{}' }],
  dependency_count: 0,
  dependent_count: 0,
  comment_count: 0,
  parent: 'bm-ooq',
})

const PROGRESS_OUT = [
  { ...listed('bm-lwgso.2', 1, '2026-10-04T22:52:00Z', 'Suspended client pages forever', 'in_progress'), assignee: 'Me', started_at: '2026-10-04T23:05:44Z' },
  { ...listed('bm-ooq.10', 0, '2026-09-11T10:00:00Z', 'Deploy the gateway', 'in_progress'), assignee: 'Me', started_at: '2026-09-11T11:00:00Z' },
]

// Three priorities, created out of order: priority first, then the oldest.
const READY_OUT = [
  listed('bm-r.3', 2, '2026-10-01T00:00:00Z', 'Third'),
  listed('bm-r.2', 1, '2026-10-02T00:00:00Z', 'Second, newer'),
  listed('bm-r.1', 1, '2026-09-30T00:00:00Z', 'First, older'),
]

const BLOCKED_OUT = [
  {
    id: 'bm-ooq.56',
    title: 'Scope the client token',
    description: '…',
    status: 'open',
    priority: 1,
    issue_type: 'bug',
    owner: 'me@example.com',
    created_at: '2026-10-04T22:39:42Z',
    created_by: 'Me',
    updated_at: '2026-10-04T22:39:42Z',
    labels: ['goal'],
    blocked_by_count: 1,
    blocked_by: ['bm-ooq.64'],
  },
]

const json = (value: unknown): Answer => ({ stdout: JSON.stringify(value, null, 2) })

const WORLD: Record<string, Answer> = { [IN_PROGRESS]: json(PROGRESS_OUT), [READY]: json(READY_OUT), [BLOCKED]: json(BLOCKED_OUT) }

const NO_DB = { exitCode: 1, stderr: "Error: no beads database found\nHint: run 'bd where' to inspect the resolved workspace" }

test('beads-pane parser: issues from bd JSON, by priority then oldest', () => {
  const beads = beadsOf(READY_OUT) ?? []
  expect([...beads].sort(byPriority).map(bead => bead.id)).toEqual(['bm-r.1', 'bm-r.2', 'bm-r.3'])
  expect(beadsOf(null)).toEqual([])
  expect(beadsOf({ count: 3 })).toBeUndefined()
  // An entry without an id, a title or a whole priority is dropped.
  expect(beadsOf([{ title: 'x', priority: 1 }, { id: 'a', priority: 1 }, { id: 'b', title: 'y', priority: '1' }, 7])).toEqual([])
})

// The kit hands a rule its own reject message, so the host's wording and the
// wall time are checked here.
test('beads-pane parser: a run that cannot start is no bd, one that timed out is no answer', () => {
  expect(rejectText('spawn bd ENOENT', 5)).toBe('bd is not installed.')
  expect(rejectText('no implementation for process.run', 0)).toBe('bd is not installed.')
  expect(rejectText('Command timed out after 10000ms', 10_000)).toBe('bd did not answer.')
  expect(rejectText('process timed out', 50)).toBe('bd did not answer.')
  expect(rejectText('the child was killed', 9_990)).toBe('bd did not answer.')
  expect(rejectText('aborted', 9_500)).toBe('bd did not answer.')
})

test('beads-pane: /beads is registered and toggles a pane that Esc closes', async ($, on) => {
  const session = probe($, on, WORLD)
  await session.start()
  expect(session.commands()).toEqual(['beads'])
  expect((await session.command('beads')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'beads', title: 'Beads', closeOnEscape: true }])
  expect((await session.command('beads')).text).toContain('closed')
  expect(session.closes()).toEqual(['beads'])
})

test('beads-pane: in progress, ready and blocked with id, priority and title, and the counts, on every surface', async ($, on) => {
  const session = probe($, on, WORLD)
  await session.command('beads')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'beads', 100)
    const rule = '─'.repeat(100)
    expect(await session.lines(ui)).toEqual([
      'In progress',
      '  bm-ooq.10   P0  Deploy the gateway',
      '  bm-lwgso.2  P1  Suspended client pages forever',
      rule,
      'Ready',
      '  bm-r.1  P1  First, older',
      '  bm-r.2  P1  Second, newer',
      '  bm-r.3  P2  Third',
      rule,
      'Blocked',
      '  bm-ooq.56  P1  Scope the client token',
      rule,
      '2 in progress   3 ready   1 blocked',
    ])
    await ui.unmount()
  }
})

test('beads-pane: only the three read-only bd calls run, one after the other', async ($, on) => {
  const session = probe($, on, WORLD)
  await session.command('beads')
  expect(session.runs()).toEqual([IN_PROGRESS, READY, BLOCKED])
})

test('beads-pane: each section shows 10, the footer counts all', async ($, on) => {
  const many = Array.from({ length: 12 }, (_, i) => listed(`bm-m.${String(i).padStart(2, '0')}`, 2, `2026-09-${String(10 + i)}T00:00:00Z`, `Task ${i}`))
  const session = probe($, on, { ...WORLD, [READY]: json(many) })
  await session.command('beads')
  const ui = await session.mount('terminal', 'beads', 100)
  const lines = await session.lines(ui)
  const ready = lines.slice(lines.indexOf('Ready') + 1, lines.indexOf('Blocked') - 1)
  expect(ready).toHaveLength(11)
  expect(ready[0]).toBe('  bm-m.00  P2  Task 0')
  expect(ready.at(-1)).toBe('  … and 2 more')
  expect(lines.at(-1)).toBe('2 in progress   12 ready   1 blocked')
  await ui.unmount()
})

test('beads-pane: empty lists read as none, with zero counts', async ($, on) => {
  const session = probe($, on, { [IN_PROGRESS]: { stdout: '[]\n' }, [READY]: { stdout: '[]\n' }, [BLOCKED]: { stdout: 'null\n' } })
  await session.command('beads')
  const ui = await session.mount('terminal', 'beads', 100)
  expect((await session.lines(ui)).filter(text => !text.startsWith('─'))).toEqual([
    'In progress',
    '  none',
    'Ready',
    '  none',
    'Blocked',
    '  none',
    '0 in progress   0 ready   0 blocked',
  ])
  await ui.unmount()
})

test('beads-pane: outside a beads project one line says so, and nothing else runs', async ($, on) => {
  const session = probe($, on, { [IN_PROGRESS]: NO_DB })
  await session.command('beads')
  const ui = await session.mount('terminal', 'beads', 100)
  expect(await session.lines(ui)).toEqual(['No beads project in this folder.'])
  expect(session.runs()).toEqual([IN_PROGRESS])
  await ui.unmount()
})

test('beads-pane: a missing bd says it is not installed', async ($, on) => {
  const session = probe($, on, { [IN_PROGRESS]: { reject: 'spawn bd ENOENT' } })
  await session.command('beads')
  const ui = await session.mount('terminal', 'beads', 100)
  expect(await session.lines(ui)).toEqual(['bd is not installed.'])
  expect(session.logs()).toEqual([])
  await ui.unmount()
})

test('beads-pane: other failures say bd did not answer, without its error text', async ($, on) => {
  const failures: Answer[] = [
    { exitCode: 2, stderr: 'Error: database is locked by /private/secret/path' },
    { stdout: '' },
    { stdout: '[{"id": "bm-1", "title": ' },
    { stdout: '{"schema_version":1}' },
    { stdout: '[]', isStdoutTruncated: true },
  ]
  const session = probe($, on, WORLD)
  for (const failure of failures) {
    session.answer(READY, failure)
    const before = session.runs().length
    await session.command('beads')
    const ui = await session.mount('terminal', 'beads', 100)
    expect(await session.lines(ui)).toEqual(['bd did not answer.'])
    // The blocked list is not read after the ready list failed.
    expect(session.runs().slice(before)).toEqual([IN_PROGRESS, READY])
    await ui.unmount()
    await session.command('beads')
    await session.clock.advance(10_000)
  }
  expect(session.logs()).toEqual([])
})

test('beads-pane: refreshes after a Bash call at most once every 10 seconds, and not after other tools', async ($, on) => {
  const session = probe($, on, WORLD)
  const loads = () => session.runs().filter(run => run === IN_PROGRESS).length
  await session.command('beads')
  expect(loads()).toBe(1)
  // Inside the 10 seconds: one load once they are out, however many calls.
  await session.bash('bd close bm-r.1')
  await session.bash('git status')
  expect(loads()).toBe(1)
  await session.clock.advance(9_000)
  expect(loads()).toBe(1)
  await session.clock.advance(1_000)
  expect(loads()).toBe(2)
  await session.clock.advance(20_000)
  expect(loads()).toBe(2)
  await session.bash('bd ready')
  expect(loads()).toBe(3)
  await session.clock.advance(20_000)
  await session.call({ tool: 'Read', file_path: `${CWD}/a.ts` })
  await session.call({ tool: 'Edit', file_path: `${CWD}/a.ts`, old_string: 'a', new_string: 'b' })
  expect(loads()).toBe(3)
  session.personClose('beads')
  await session.bash('bd ready')
  await session.clock.advance(60_000)
  expect(loads()).toBe(3)
})

test('beads-pane: color codes and tabs in a title or an id are cleaned out', async ($, on) => {
  const dirty = { ...BLOCKED_OUT[0], id: 'bm-ooq.56\t', title: 'Scope\u001b[31m the\ttoken\u001b[0m' }
  const session = probe($, on, { ...WORLD, [BLOCKED]: json([dirty]) })
  await session.command('beads')
  const ui = await session.mount('terminal', 'beads', 100)
  const lines = await session.lines(ui)
  expect(lines[lines.indexOf('Blocked') + 1]).toBe('  bm-ooq.56   P1  Scope the token')
  await ui.unmount()
})

test('beads-pane: a long title is cut to fit, control characters cleaned, on every surface', async ($, on) => {
  const long = `Fix the ${'very '.repeat(40)}long\u001b[31m title\tend`
  const session = probe($, on, { ...WORLD, [BLOCKED]: json([{ ...BLOCKED_OUT[0], title: long }]) })
  await session.command('beads')
  for (const surface of SURFACES) {
    for (const columns of [100, 40]) {
      const ui = await session.mount(surface, 'beads', columns)
      const lines = await session.lines(ui)
      const row = lines[lines.indexOf('Blocked') + 1] ?? ''
      expect(row.length).toBe(columns)
      expect(row.startsWith('  bm-ooq.56  P1  Fix the very')).toBe(true)
      expect(row.endsWith('…')).toBe(true)
      expect(lines.every(text => text.length <= columns && !/[\u0000-\u001f]/.test(text))).toBe(true)
      await ui.unmount()
    }
  }
})
