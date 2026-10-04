import { expect, test } from 'claude-code/testing'

import { barCells, lineDiff, MAX_BAR } from '../hooks/diff'
import { ENGINE_KEY, mountToolUse, standIn, SURFACES, toolUse, rootProps } from './probe'

const lines = (n: number, word = 'line'): string => Array.from({ length: n }, (_, i) => `${word} ${i + 1}`).join('\n')

const EDIT = {
  file_path: '/repo/src/a.ts',
  old_string: 'const a = 1\nconst b = 2\n',
  new_string: 'const a = 1\nconst b = 3\nconst c = 4\n',
}

type Ui = Awaited<ReturnType<typeof mountToolUse>>

const textOf = async (ui: Ui, pattern: RegExp) => ui.find({ type: 'Text', text: pattern })

test('diff-stats: lineDiff counts lines added and removed', () => {
  expect(lineDiff(EDIT.old_string, EDIT.new_string)).toEqual({ added: 2, removed: 1 })
  expect(lineDiff('', 'a\nb\nc')).toEqual({ added: 3, removed: 0 })
  expect(lineDiff('a\nb\nc', 'a\nc')).toEqual({ added: 0, removed: 1 })
  expect(lineDiff('same', 'same')).toEqual({ added: 0, removed: 0 })
  expect(lineDiff('x\na\nb\ny', 'x\nb\na\ny')).toEqual({ added: 1, removed: 1 })
})

test('diff-stats: a very large edit still counts, without a full diff', () => {
  const before = lines(3000, 'old')
  const after = lines(3000, 'new')
  expect(lineDiff(before, after)).toEqual({ added: 3000, removed: 3000 })
})

test('diff-stats: the bar is proportional and at most 20 cells', () => {
  expect(MAX_BAR).toBe(20)
  expect(barCells({ added: 2, removed: 1 })).toEqual({ green: 2, red: 1 })
  expect(barCells({ added: 12, removed: 3 })).toEqual({ green: 12, red: 3 })
  expect(barCells({ added: 30, removed: 10 })).toEqual({ green: 15, red: 5 })
  expect(barCells({ added: 500, removed: 0 })).toEqual({ green: 20, red: 0 })
  // A side with any lines keeps at least one cell.
  expect(barCells({ added: 1, removed: 400 })).toEqual({ green: 1, red: 19 })
  expect(barCells({ added: 400, removed: 1 })).toEqual({ green: 19, red: 1 })
  expect(barCells({ added: 0, removed: 0 })).toEqual({ green: 0, red: 0 })
})

test('diff-stats: an Edit row draws +2 -1 and a green and red bar beside the engine row', async ($, on) => {
  standIn(on)
  for (const surface of SURFACES) {
    const ui = await mountToolUse($, surface, toolUse('Edit', EDIT))
    const drawn = await ui.drawn()
    expect({ surface, root: drawn.type, hasEngineRow: (await ui.find({ key: ENGINE_KEY })) !== undefined }).toEqual({
      surface,
      root: 'Box',
      hasEngineRow: true,
    })
    expect((await ui.find({ key: 'diff-stats' }))?.text).toBe('+2 -1 ███')
    expect((await textOf(ui, /^\+2$/))?.props.color).toBe('green')
    expect((await textOf(ui, /^-1$/))?.props.color).toBe('red')
    expect((await textOf(ui, /^██$/))?.props.color).toBe('green')
    expect((await textOf(ui, /^█$/))?.props.color).toBe('red')
    await ui.unmount()
  }
})

test('diff-stats: the engine row comes first and the bar sits beside it', async ($, on) => {
  standIn(on)
  for (const surface of SURFACES) {
    const ui = await mountToolUse($, surface, toolUse('Edit', EDIT))
    const drawn = await ui.drawn()
    expect(rootProps(drawn).flexDirection).toBe('row')
    const row = await ui.find({ type: 'Box' })
    expect(row?.text).toBe('Edit(row) +2 -1 ███')
    await ui.unmount()
  }
})

test('diff-stats: a Write row counts its content as added', async ($, on) => {
  standIn(on)
  for (const surface of SURFACES) {
    const ui = await mountToolUse($, surface, toolUse('Write', { file_path: '/repo/b.ts', content: `${lines(12)}\n` }))
    expect((await ui.find({ key: 'diff-stats' }))?.text).toBe(`+12 -0 ${'█'.repeat(12)}`)
    expect((await textOf(ui, /^█{12}$/))?.props.color).toBe('green')
    expect(await textOf(ui, /^-0$/)).toBeDefined()
    expect(await ui.find({ key: ENGINE_KEY })).toBeDefined()
    await ui.unmount()
  }
})

test('diff-stats: a long Write caps the bar at 20 cells', async ($, on) => {
  standIn(on)
  const ui = await mountToolUse($, 'terminal', toolUse('Write', { file_path: '/repo/big.ts', content: lines(200) }))
  expect((await ui.find({ key: 'diff-stats' }))?.text).toBe(`+200 -0 ${'█'.repeat(20)}`)
  await ui.unmount()
})

test('diff-stats: other tools, odd input and failed calls keep the engine row alone', async ($, on) => {
  standIn(on)
  const cases = [
    toolUse('Read', { file_path: '/repo/a.ts' }),
    toolUse('Bash', { command: 'ls' }),
    toolUse('Edit', { file_path: '/repo/a.ts', old_string: 'a' }),
    toolUse('Write', { file_path: '/repo/a.ts', content: 42 }),
    toolUse('Edit', 'not an object'),
    toolUse('Edit', { ...EDIT, new_string: EDIT.old_string }),
    toolUse('Edit', EDIT, { isErrored: true }),
    toolUse('Write', { file_path: '/repo/a.ts', content: 'x' }, { isInterrupted: true }),
  ]
  for (const surface of SURFACES) {
    for (const props of cases) {
      const ui = await mountToolUse($, surface, props)
      const drawn = await ui.drawn()
      expect({ surface, tool: props.tool, key: rootProps(drawn).key }).toEqual({
        surface,
        tool: props.tool,
        key: ENGINE_KEY,
      })
      expect(await ui.find({ key: 'diff-stats' })).toBeUndefined()
      await ui.unmount()
    }
  }
})
