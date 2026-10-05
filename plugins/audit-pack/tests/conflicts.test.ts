import { expect, test } from 'claude-code/testing'

import { IN_REPO } from './fixtures'
import { probe } from './probe'

const GREP = 'grep -n -I --null -E -e ^(<<<<<<<|>>>>>>>)([[:space:]].*)?$|^=======[[:space:]]*$'
// git writes `path NUL line NUL text` with --null.
const hit = (path: string, line: number, text: string) => `${path}\0${line}\0${text}`
const found = (...rows: string[]) => ({ git: { ...IN_REPO, [GREP]: rows.join('\n') + '\n' } })

test('conflicts: registers /conflicts with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'conflicts')?.description).toMatch(/conflict markers/i)
})

test('conflicts: lists each file with its marker line numbers', async ($, on) => {
  const session = probe(
    $,
    on,
    found(
      hit('src/a.ts', 3, '<<<<<<< HEAD'),
      hit('src/a.ts', 7, '======='),
      hit('src/a.ts', 11, '>>>>>>> feature'),
      hit('b.md', 20, '<<<<<<<'),
      hit('b.md', 22, '======='),
      hit('b.md', 24, '>>>>>>> x'),
    ),
  )
  const text = await session.run('conflicts')
  expect(text.startsWith(['Tracked files with conflict markers: 2', '', 'src/a.ts  lines 3, 7, 11', 'b.md  lines 20, 22, 24'].join('\n'))).toBe(true)
})

test('conflicts: a lone ======= underline is not a conflict', async ($, on) => {
  const session = probe($, on, found(hit('docs/guide.rst', 2, '======='), hit('x.ts', 1, '<<<<<<< HEAD')))
  const text = await session.run('conflicts')
  expect(text).toContain('x.ts  line 1')
  expect(text).not.toContain('guide.rst')
})

test('conflicts: a file with only underlines gives the clean answer', async ($, on) => {
  const session = probe($, on, found(hit('docs/guide.rst', 2, '=======')))
  expect(await session.run('conflicts')).toBe('No conflict markers in tracked files.')
  expect(session.copied()).toEqual([])
})

test('conflicts: no match (grep exit 1) says clean', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  expect(await session.run('conflicts')).toBe('No conflict markers in tracked files.')
})

test('conflicts: a grep failure is never read as clean', async ($, on) => {
  const session = probe($, on, { git: IN_REPO, exit: { [GREP]: 128 } })
  expect(await session.run('conflicts')).toMatch(/^conflicts: failed, git grep failed \(exit 128\)/)
})

test('conflicts: output cut at the cap is reported', async ($, on) => {
  const session = probe($, on, { ...found(hit('a', 1, '<<<<<<<')), truncated: [GREP] })
  expect(await session.run('conflicts')).toMatch(/^conflicts: failed, git grep output passed the 4 MiB cap/)
})

test('conflicts: caps the files and the line numbers per file', async ($, on) => {
  const many = Array.from({ length: 12 }, (_, i) => hit('big.txt', i + 1, '<<<<<<< x'))
  const files = Array.from({ length: 45 }, (_, i) => hit(`f${i}.txt`, 1, '<<<<<<< x'))
  const session = probe($, on, found(...many, ...files))
  const text = await session.run('conflicts')
  expect(text).toContain('big.txt  lines 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, +2 more')
  expect(text).toContain('+6 more files')
})

test('conflicts: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('conflicts')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('conflicts: only reads, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, found(hit('a', 1, '<<<<<<<')))
  await session.run('conflicts')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
})
