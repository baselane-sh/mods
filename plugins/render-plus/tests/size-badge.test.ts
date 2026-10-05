import { expect, test } from 'claude-code/testing'

import { formatBytes } from '../hooks/badge'
import { ENGINE_KEY, mountToolUse, rootProps, standIn, SURFACES, toolUse } from './probe'

const KEY = 'size-badge'
const FILE = '/repo/src/app.ts'

const readText = (numLines: number, totalLines: number) => ({
  type: 'text',
  file: { filePath: FILE, content: 'x', numLines, startLine: 1, totalLines },
})
const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n')

test('size-badge: formatBytes writes bytes, then one decimal under 10 of a unit', () => {
  expect(formatBytes(512)).toBe('512 B')
  expect(formatBytes(4300)).toBe('4.2 KB')
  expect(formatBytes(49_152)).toBe('48 KB')
  expect(formatBytes(2_500_000)).toBe('2.4 MB')
  expect(formatBytes(5 * 1024 ** 4)).toBe('5120 GB')
})

test('size-badge: Read rows show the line count, a partial read of how many', async ($, on) => {
  standIn(on)
  const cases: Array<[ReturnType<typeof toolUse>, string]> = [
    [toolUse('Read', { file_path: FILE }, { output: readText(312, 312) }), '312 lines'],
    [toolUse('Read', { file_path: FILE, limit: 50 }, { output: readText(50, 312) }), '50 of 312 lines'],
    [toolUse('Read', { file_path: FILE }, { output: readText(1, 1) }), '1 line'],
    [toolUse('Read', { file_path: '/repo/a.png' }, { output: { type: 'image', file: { base64: '', type: 'image/png', originalSize: 49_152 } } }), '48 KB'],
    [toolUse('Read', { file_path: '/repo/a.pdf' }, { output: { type: 'pdf', file: { filePath: '/repo/a.pdf', base64: '', originalSize: 2_500_000 } } }), '2.4 MB'],
  ]
  for (const surface of SURFACES) {
    for (const [props, text] of cases) {
      const ui = await mountToolUse($, surface, props)
      expect({ surface, text: (await ui.find({ key: KEY }))?.text }).toEqual({ surface, text })
      expect((await ui.find({ type: 'Text', text }))?.props.dimColor).toBe(true)
      expect(await ui.find({ key: ENGINE_KEY })).toBeDefined()
      await ui.unmount()
    }
  }
})

test('size-badge: a Write row shows the lines written', async ($, on) => {
  standIn(on)
  for (const surface of SURFACES) {
    const content = `${lines(12)}\n`
    const ui = await mountToolUse(
      $,
      surface,
      toolUse('Write', { file_path: FILE, content }, { output: { type: 'create', filePath: FILE, content, structuredPatch: [], originalFile: null } }),
    )
    expect((await ui.find({ key: KEY }))?.text).toBe('12 lines')
    expect(rootProps(await ui.drawn()).flexDirection).toBe('row')
    await ui.unmount()
  }
  // The content the person edited in the dialog is what was written.
  const edited = await mountToolUse(
    $,
    'terminal',
    toolUse('Write', { file_path: FILE, content: lines(3) }, { output: { type: 'update', filePath: FILE, content: lines(5), structuredPatch: [], originalFile: '', userModified: true } }),
  )
  expect((await edited.find({ key: KEY }))?.text).toBe('5 lines')
  await edited.unmount()
})

test('size-badge: running, failed, unchanged, staged and other rows keep the engine row alone', async ($, on) => {
  standIn(on)
  const cases = [
    toolUse('Read', { file_path: FILE }, { isRunning: true }),
    toolUse('Read', { file_path: FILE }, { isErrored: true, output: 'File does not exist.' }),
    toolUse('Read', { file_path: FILE }, { output: { type: 'file_unchanged', file: { filePath: FILE } } }),
    toolUse('Read', { file_path: FILE }, { output: { type: 'text', file: { filePath: FILE } } }),
    toolUse('Write', { file_path: FILE, content: 'x' }, { isInterrupted: true }),
    toolUse('Write', { file_path: FILE, content: 'x' }, { output: { type: 'update', filePath: FILE, content: 'x', structuredPatch: [], originalFile: '', staged: true } }),
    toolUse('Edit', { file_path: FILE, old_string: 'a', new_string: 'a' }, { output: {} }),
    toolUse('Grep', { pattern: 'x' }, { output: 'a.ts' }),
  ]
  for (const surface of SURFACES) {
    for (const [index, props] of cases.entries()) {
      const ui = await mountToolUse($, surface, props)
      const drawn = await ui.drawn()
      expect({ surface, index, key: rootProps(drawn).key }).toEqual({ surface, index, key: ENGINE_KEY })
      await ui.unmount()
    }
  }
})
