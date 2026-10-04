import { expect, test } from 'claude-code/testing'

import { parseMarkers } from '../hooks/rules/todo-pane'
import { CWD, SURFACES, probe } from './probe'
import type { Answer } from './probe'

const GREP = `git --no-optional-locks -C ${CWD} grep -z -n -I -w -E -e TODO|FIXME|HACK`

// `git grep -z -n` output: path, NUL, line number, NUL, the line. A path may
// hold a colon or a space, which is why the pane asks for -z.
const hit = (path: string, n: number, text: string): string => `${path}\u0000${n}\u0000${text}`

const GREP_OUT = [
  hit('src/app.ts', 12, '  // TODO: split this file'),
  hit('src/app.ts', 140, '  return x // FIXME off by one'),
  hit('src/db:v2.ts', 7, '# HACK until the driver is fixed'),
  hit('src/db:v2.ts', 9, '# TODO drop the retry'),
  hit('notes and plans.md', 3, '- TODO write the docs'),
  hit('notes and plans.md', 4, '- FIXME: dates are UTC'),
  '',
].join('\n')

const REPO: Record<string, Answer> = { [GREP]: { stdout: GREP_OUT } }

const grepRuns = (runs: readonly string[]) => runs.filter(run => run === GREP).length

test('todo-pane parser: path, line and marker from git grep -z, the text from the marker on', () => {
  expect(parseMarkers(GREP_OUT).slice(0, 3)).toEqual([
    { path: 'src/app.ts', line: 12, tag: 'TODO', text: ': split this file' },
    { path: 'src/app.ts', line: 140, tag: 'FIXME', text: ' off by one' },
    { path: 'src/db:v2.ts', line: 7, tag: 'HACK', text: ' until the driver is fixed' },
  ])
  expect(parseMarkers('')).toEqual([])
  // A line without a whole marker word (git -w can match inside other text) is dropped.
  expect(parseMarkers(hit('a.ts', 1, 'TODOS and HACKY'))).toEqual([])
})

test('todo-pane: /todo-pane is registered and toggles a pane that Esc closes', async ($, on) => {
  const session = probe($, on, REPO)
  await session.start()
  expect(session.commands()).toEqual(['todo-pane'])
  expect((await session.command('todo-pane')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'todo', title: 'TODOs', closeOnEscape: true }])
  expect((await session.command('todo-pane')).text).toContain('closed')
  expect(session.closes()).toEqual(['todo'])
})

test('todo-pane: markers grouped by file at 72 columns on every surface', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('todo-pane')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'todo', 72)
    expect((await ui.find({ key: 'header' }))?.text).toBe('TODOs  updated 12:34:56')
    expect(await session.lines(ui)).toEqual([
      '6 markers in 3 files  TODO 3  FIXME 2  HACK 1',
      'src/app.ts',
      '   12  TODO: split this file',
      '  140  FIXME off by one',
      'src/db:v2.ts',
      '    7  HACK until the driver is fixed',
      '    9  TODO drop the retry',
      'notes and plans.md',
      '    3  TODO write the docs',
      '    4  FIXME: dates are UTC',
    ])
    await ui.unmount()
  }
})

test('todo-pane: the marker word carries a color, and the word says it without one', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('todo-pane')
  const ui = await session.mount('terminal', 'todo')
  const colors = async (text: string) => (await ui.findAll({ type: 'Text', text })).map(each => each.props.color)
  expect(await colors('TODO')).toContain('yellow')
  expect(await colors('FIXME')).toContain('red')
  expect(await colors('HACK')).toContain('magenta')
  await ui.unmount()
})

test('todo-pane: more than 30 markers are capped with a count of the rest', async ($, on) => {
  const many = Array.from({ length: 35 }, (_, n) => hit(`f${Math.floor(n / 10)}.ts`, n + 1, `// TODO item ${n}`)).join('\n')
  const session = probe($, on, { [GREP]: { stdout: `${many}\n` } })
  await session.command('todo-pane')
  const ui = await session.mount('terminal', 'todo')
  const lines = await session.lines(ui)
  expect(lines[0]).toBe('35 markers in 4 files  TODO 35')
  expect(lines.filter(text => /^ +\d+  TODO/.test(text))).toHaveLength(30)
  expect(lines).toContain('f2.ts')
  expect(lines).not.toContain('f3.ts')
  expect(lines.at(-1)).toBe('… and 5 more')
  await ui.unmount()
})

test('todo-pane: one marker reads in the singular', async ($, on) => {
  const session = probe($, on, { [GREP]: { stdout: `${hit('a.ts', 1, 'HACK')}\n` } })
  await session.command('todo-pane')
  const ui = await session.mount('terminal', 'todo')
  expect(await session.lines(ui)).toEqual(['1 marker in 1 file  HACK 1', 'a.ts', '  1  HACK'])
  await ui.unmount()
})

test('todo-pane: no markers (git grep exits 1) reads as such', async ($, on) => {
  const session = probe($, on, { [GREP]: { exitCode: 1 } })
  await session.command('todo-pane')
  const ui = await session.mount('terminal', 'todo')
  expect(await session.lines(ui)).toEqual(['No TODO, FIXME or HACK in tracked files.'])
  await ui.unmount()
})

test('todo-pane: outside a repo the pane says so', async ($, on) => {
  const session = probe($, on, { [GREP]: { exitCode: 128, stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' } })
  await session.command('todo-pane')
  const ui = await session.mount('terminal', 'todo')
  expect(await session.lines(ui)).toEqual([`Not a git repository: ${CWD}`])
  await ui.unmount()
})

test('todo-pane: another git error is shown', async ($, on) => {
  const session = probe($, on, { [GREP]: { exitCode: 2, stderr: 'fatal: bad flag\nusage' } })
  await session.command('todo-pane')
  const ui = await session.mount('terminal', 'todo', 120)
  expect(await session.lines(ui)).toEqual(['git grep failed: fatal: bad flag'])
  await ui.unmount()
})

test('todo-pane: a git that does not start is reported, not thrown', async ($, on) => {
  const session = probe($, on, { [GREP]: { reject: 'spawn git ENOENT' } })
  await session.command('todo-pane')
  const ui = await session.mount('terminal', 'todo')
  expect((await session.lines(ui))[0]).toMatch(/^git did not run: /)
  await ui.unmount()
})

test('todo-pane: writes and edits refresh it while open; reads and commands do not', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('todo-pane')
  expect(grepRuns(session.runs())).toBe(1)
  await session.clock.advance(2_000)
  await session.call({ tool: 'Edit', file_path: `${CWD}/src/app.ts`, old_string: 'a', new_string: 'b' })
  expect(grepRuns(session.runs())).toBe(2)
  await session.clock.advance(2_000)
  await session.call({ tool: 'Write', file_path: `${CWD}/b.ts`, content: '// TODO' })
  expect(grepRuns(session.runs())).toBe(3)
  await session.clock.advance(2_000)
  await session.call({ tool: 'Read', file_path: `${CWD}/b.ts` })
  await session.bash('git commit -m wip')
  expect(grepRuns(session.runs())).toBe(3)
})

test('todo-pane: a new marker shows after the edit that added it', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('todo-pane')
  await session.clock.advance(2_000)
  session.answer(GREP, { stdout: `${hit('b.ts', 1, '// TODO new one')}\n` })
  await session.call({ tool: 'Write', file_path: `${CWD}/b.ts`, content: '// TODO new one' })
  const ui = await session.mount('terminal', 'todo')
  expect(await session.lines(ui)).toEqual(['1 marker in 1 file  TODO 1', 'b.ts', '  1  TODO new one'])
  await ui.unmount()
})

test('todo-pane: a closed pane runs nothing after an edit, and has no timer', async ($, on) => {
  const session = probe($, on, REPO)
  await session.call({ tool: 'Edit', file_path: `${CWD}/a.ts`, old_string: 'a', new_string: 'b' })
  expect(session.runs()).toEqual([])
  await session.command('todo-pane')
  await session.clock.advance(120_000)
  expect(grepRuns(session.runs())).toBe(1)
})

test('todo-pane: lines fit narrow panes on every surface', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('todo-pane')
  for (const surface of SURFACES) {
    for (const columns of [40, 20, 8]) {
      const ui = await session.mount(surface, 'todo', columns)
      for (const text of await session.lines(ui)) {
        expect({ surface, columns, text, fits: text.length <= columns }).toEqual({ surface, columns, text, fits: true })
      }
      await ui.unmount()
    }
  }
})

test('todo-pane: a credential in a marker line or a path is redacted', async ($, on) => {
  const key = 'sk-ant-' + 'api03-abcdefghijklmnopqrstuvwxyz'
  const session = probe($, on, { [GREP]: { stdout: `${hit(`${key}.ts`, 2, `// TODO rotate ${key}`)}\n` } })
  await session.command('todo-pane')
  const ui = await session.mount('terminal', 'todo', 200)
  const text = (await session.lines(ui)).join('\n')
  expect(text).toContain('[REDACTED]')
  expect(text).not.toContain(key.slice(0, 12))
  await ui.unmount()
})

test('todo-pane: control characters in a line are cleaned', async ($, on) => {
  const session = probe($, on, { [GREP]: { stdout: `${hit('a.ts', 1, 'TODO\tfix \u001b[31mred\u001b[0m')}\n` } })
  await session.command('todo-pane')
  const ui = await session.mount('terminal', 'todo')
  expect((await session.lines(ui)).at(-1)).toBe('  1  TODO fix red')
  await ui.unmount()
})
