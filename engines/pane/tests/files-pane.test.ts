import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const RULE = '─'.repeat(72)

// A file call asks for a load even while the pane is closed, and loads come
// at most once a second, so the pane opens two seconds on.
const opened = async (session: ReturnType<typeof probe>) => {
  await session.clock.advance(2_000)
  await session.command('files')
}

test('files-pane: /files is registered and toggles a pane that Esc closes', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.commands()).toEqual(['files'])
  expect((await session.command('files')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'files', title: 'Files', closeOnEscape: true }])
  expect((await session.command('files')).text).toContain('closed')
  expect(session.closes()).toEqual(['files'])
})

test('files-pane: files grouped by action with counts, newest first, on every surface', async ($, on) => {
  const session = probe($, on)
  await session.call({ tool: 'Read', file_path: '/repo/b.ts' })
  await session.call({ tool: 'Read', file_path: '/repo/src/a.ts' })
  await session.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'x', new_string: 'y' })
  await session.call({ tool: 'Edit', file_path: '/repo/src/a.ts', old_string: 'y', new_string: 'z' })
  await session.call({ tool: 'Write', file_path: '/repo/c.md', content: 'x' })
  await session.call({ tool: 'Read', file_path: '/etc/hosts' })
  await session.bash('cat /repo/d.ts')
  await session.call({ tool: 'WebFetch', url: 'https://a.dev', prompt: 'x' })
  await opened(session)
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'files', 72)
    expect((await ui.find({ key: 'header' }))?.text).toBe('Files  updated 12:34:58')
    expect(await session.lines(ui)).toEqual([
      '4 files this session: 1 edited, 1 written, 3 read',
      RULE,
      'Edited (1)',
      '  src/a.ts  ×2',
      RULE,
      'Wrote (1)',
      '  c.md  ×1',
      RULE,
      'Read (3)',
      '  /etc/hosts  ×1',
      '  src/a.ts  ×1',
      '  b.ts  ×1',
    ])
    await ui.unmount()
  }
})

test('files-pane: an Edit and a NotebookEdit count as edits', async ($, on) => {
  const session = probe($, on)
  await session.call({ tool: 'Edit', file_path: '/repo/m.ts', old_string: 'a', new_string: 'b' })
  await session.call({ tool: 'NotebookEdit', notebook_path: '/repo/n.ipynb', new_source: 'x' })
  await opened(session)
  const ui = await session.mount('terminal', 'files', 72)
  expect(await session.lines(ui)).toEqual(['2 files this session: 2 edited, 0 written, 0 read', RULE, 'Edited (2)', '  n.ipynb  ×1', '  m.ts  ×1'])
  await ui.unmount()
})

test('files-pane: a failed call touched no file', async ($, on) => {
  const session = probe($, on)
  await session.call({ tool: 'Read', file_path: '/repo/missing.ts' }, { isError: true, text: 'File does not exist.' })
  await session.call({ tool: 'Write', file_path: '/repo/ok.ts', content: 'x' })
  await opened(session)
  const ui = await session.mount('terminal', 'files', 72)
  const text = (await session.lines(ui)).join('\n')
  expect(text).not.toContain('missing.ts')
  expect(text).toContain('ok.ts')
  await ui.unmount()
})

test('files-pane: the open pane redraws after a file call', async ($, on) => {
  const session = probe($, on)
  await opened(session)
  const before = await session.mount('terminal', 'files', 72)
  expect(await session.lines(before)).toEqual(['No file read, edited or written yet.'])
  await before.unmount()
  await session.clock.advance(2_000)
  await session.call({ tool: 'Read', file_path: '/repo/a.ts' })
  const after = await session.mount('terminal', 'files', 72)
  expect((await session.lines(after)).at(-1)).toBe('  a.ts  ×1')
  await after.unmount()
})

test('files-pane: a group shows its 15 newest files, then a count of the rest', async ($, on) => {
  const session = probe($, on)
  for (let i = 1; i <= 18; i += 1) await session.call({ tool: 'Read', file_path: `/repo/f${i}.ts` })
  await opened(session)
  const ui = await session.mount('terminal', 'files', 72)
  const lines = await session.lines(ui)
  expect(lines[2]).toBe('Read (18)')
  expect(lines[3]).toBe('  f18.ts  ×1')
  expect(lines.filter(text => text.startsWith('  f'))).toHaveLength(15)
  expect(lines.at(-1)).toBe('  … and 3 more')
  await ui.unmount()
})

test('files-pane: a project in a folder that only shares a prefix is not cut', async ($, on) => {
  const session = probe($, on)
  await session.call({ tool: 'Read', file_path: '/repo-old/a.ts' })
  await opened(session)
  const ui = await session.mount('terminal', 'files', 72)
  expect((await session.lines(ui)).at(-1)).toBe('  /repo-old/a.ts  ×1')
  await ui.unmount()
})

test('files-pane: lines fit narrow panes and a credential in a path is redacted', async ($, on) => {
  const key = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789'
  const session = probe($, on)
  await session.call({ tool: 'Read', file_path: `/repo/${key}/notes-with-a-long-name.md` })
  await session.call({ tool: 'Edit', file_path: '/repo/src/components/very/deep/folder/Button.tsx', old_string: 'a', new_string: 'b' })
  await opened(session)
  for (const surface of SURFACES) {
    for (const columns of [120, 30, 8]) {
      const ui = await session.mount(surface, 'files', columns)
      const lines = await session.lines(ui)
      for (const text of lines) expect({ surface, columns, text, fits: text.length <= columns }).toEqual({ surface, columns, text, fits: true })
      expect(lines.join('\n')).not.toContain(key.slice(0, 10))
      if (columns === 120) expect(lines.join('\n')).toContain('[REDACTED]')
      await ui.unmount()
    }
  }
})

test('files-pane: runs no command and reads no file', async ($, on) => {
  const session = probe($, on)
  await opened(session)
  await session.call({ tool: 'Read', file_path: '/repo/a.ts' })
  await session.call({ tool: 'Write', file_path: '/repo/b.ts', content: 'x' })
  expect(session.runs()).toEqual([])
})
