import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { MIN_LENGTH, shortenPath } from '../hooks/rules/path-shorten'
import { CWD, mountToolUse, repository, SURFACES, toolUse } from './probe'

type OnFn = Parameters<TestBody>[1]

const HOME = '/Users/me'
const DEEP = `${CWD}/src/components/very/deep/folder/Button.tsx`
const MEMORY = `${HOME}/.claude/projects/x/memory/MEMORY.md`
const OUTSIDE = '/opt/homebrew/lib/node_modules/some/long/path/file.js'

// The engine beneath draws the path field the row's input carries, so a
// rewrite of the props shows in the drawing.
const pathRow = (on: OnFn): void => {
  on('ui.log', () => ({ value: undefined }))
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const input = (e.props.input ?? {}) as Record<string, unknown>
    const shown = input['file_path'] ?? input['notebook_path'] ?? input['path'] ?? input['command']
    return h(Box, { key: 'row' }, h(Text, null, `${e.props.tool}(${String(shown)})`)) as RenderElement
  })
}

const rowText = async (ui: Awaited<ReturnType<typeof mountToolUse>>) => (await ui.find({ key: 'row' }))?.text

test('path-shorten: shortenPath writes the project root as ./ and home as ~, longest match first', () => {
  expect(shortenPath(DEEP, CWD, HOME)).toBe('./src/components/very/deep/folder/Button.tsx')
  expect(shortenPath(MEMORY, CWD, HOME)).toBe('~/.claude/projects/x/memory/MEMORY.md')
  expect(shortenPath(`${HOME}/proj/a/b/c.ts`, `${HOME}/proj`, HOME)).toBe('./a/b/c.ts')
  expect(shortenPath(OUTSIDE, CWD, HOME)).toBe(OUTSIDE)
  expect(shortenPath('/Users/me2/notes/a.md', CWD, HOME)).toBe('/Users/me2/notes/a.md')
  expect(shortenPath(`${CWD}-old/a.ts`, CWD, HOME)).toBe(`${CWD}-old/a.ts`)
  expect(shortenPath('/etc/a/b.conf', '/', '/')).toBe('/etc/a/b.conf')
  expect(shortenPath(MEMORY, CWD, undefined)).toBe(MEMORY)
})

test('path-shorten: a long path on a Read row is drawn from the project root on every surface', async ($, on) => {
  pathRow(on)
  repository(on, null, HOME)
  for (const surface of SURFACES) {
    const ui = await mountToolUse($, surface, toolUse('Read', { file_path: DEEP, offset: 10, limit: 20 }))
    expect(await rowText(ui)).toBe('Read(./src/components/very/deep/folder/Button.tsx)')
    await ui.unmount()
  }
})

test('path-shorten: a long path under home is drawn with ~', async ($, on) => {
  pathRow(on)
  repository(on, null, HOME)
  const ui = await mountToolUse($, 'terminal', toolUse('Edit', { file_path: MEMORY, old_string: 'a', new_string: 'b' }))
  expect(await rowText(ui)).toBe('Edit(~/.claude/projects/x/memory/MEMORY.md)')
  await ui.unmount()
})

test('path-shorten: notebook_path and path fields are shortened too', async ($, on) => {
  pathRow(on)
  repository(on, null, HOME)
  const notebook = await mountToolUse($, 'terminal', toolUse('NotebookEdit', { notebook_path: `${CWD}/notebooks/analysis/2026/october/run.ipynb`, new_source: 'x' }))
  expect(await rowText(notebook)).toBe('NotebookEdit(./notebooks/analysis/2026/october/run.ipynb)')
  await notebook.unmount()
  const listing = await mountToolUse($, 'terminal', toolUse('mcp__fs__list', { path: `${HOME}/Library/Application Support/Some App/data` }))
  expect(await rowText(listing)).toBe('mcp__fs__list(~/Library/Application Support/Some App/data)')
  await listing.unmount()
})

test('path-shorten: short paths, paths elsewhere, relative paths and Bash commands are drawn as given', async ($, on) => {
  pathRow(on)
  repository(on, null, HOME)
  const longCommand = `cat ${DEEP} | wc -l`
  const cases: readonly [string, Record<string, unknown>, string][] = [
    ['Read', { file_path: `${CWD}/a.ts` }, `Read(${CWD}/a.ts)`],
    ['Read', { file_path: OUTSIDE }, `Read(${OUTSIDE})`],
    ['Read', { file_path: 'src/components/very/deep/folder/Button.tsx' }, 'Read(src/components/very/deep/folder/Button.tsx)'],
    ['Bash', { command: longCommand }, `Bash(${longCommand})`],
  ]
  for (const [tool, input, expected] of cases) {
    const ui = await mountToolUse($, 'terminal', toolUse(tool, input))
    expect(await rowText(ui)).toBe(expected)
    await ui.unmount()
  }
})

test('path-shorten: a path of exactly MIN_LENGTH characters stays; one more is shortened', async ($, on) => {
  pathRow(on)
  repository(on, null, HOME)
  const at = `${CWD}/${'a'.repeat(MIN_LENGTH - CWD.length - 4)}.ts`
  expect(at.length).toBe(MIN_LENGTH)
  const kept = await mountToolUse($, 'terminal', toolUse('Read', { file_path: at }))
  expect(await rowText(kept)).toBe(`Read(${at})`)
  await kept.unmount()
  const longer = `${CWD}/b${at.slice(CWD.length + 1)}`
  const cut = await mountToolUse($, 'terminal', toolUse('Read', { file_path: longer }))
  expect(await rowText(cut)).toBe(`Read(./${longer.slice(CWD.length + 1)})`)
  await cut.unmount()
})

test('path-shorten: the rewrite changes the drawing only, never the props it was given', async ($, on) => {
  pathRow(on)
  repository(on, null, HOME)
  const props = toolUse('Read', { file_path: DEEP })
  const ui = await mountToolUse($, 'terminal', props)
  expect(await rowText(ui)).toBe('Read(./src/components/very/deep/folder/Button.tsx)')
  expect((props.input as { file_path: string }).file_path).toBe(DEEP)
  await ui.unmount()
})
