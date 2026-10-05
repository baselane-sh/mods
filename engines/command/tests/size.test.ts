import { expect, test } from 'claude-code/testing'

import { IN_REPO } from './fixtures'
import { probe } from './probe'

const LS = 'ls-tree -r -l -z HEAD'
const row = (bytes: number | '-', path: string, type = 'blob') => `100644 ${type} abc123${' '.repeat(3)}${bytes}\t${path}`
const tree = (rows: string[]) => ({ git: { ...IN_REPO, [LS]: rows.join('\0') + '\0' } })

test('size: registers /size with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'size')?.description).toMatch(/largest/i)
})

test('size: lists the largest files first with the total', async ($, on) => {
  const session = probe($, on, tree([row(100, 'a.txt'), row(5 * 1024 * 1024, 'big.bin'), row(2048, 'src/mid.ts')]))
  const text = await session.run('size')
  expect(text.startsWith(['Tracked size at HEAD: 5.0 MB in 3 files', '', 'Largest 3:', '5.0 MB  big.bin', '2.0 KB  src/mid.ts', '100 B  a.txt'].join('\n'))).toBe(true)
  expect(session.copied().length).toBe(1)
})

test('size: shows only the 15 largest', async ($, on) => {
  const rows = Array.from({ length: 20 }, (_, i) => row(1000 + i, `f${String(i).padStart(2, '0')}.txt`))
  const session = probe($, on, tree(rows))
  await session.run('size')
  const out = session.copied()[0] ?? ''
  expect(out).toContain('in 20 files')
  expect(out.split('\n').filter(l => l.includes('.txt')).length).toBe(15)
  expect(out).toContain('f19.txt')
  expect(out).not.toContain('f04.txt')
})

test('size: a path with spaces stays whole and a submodule row is skipped', async ($, on) => {
  const session = probe($, on, tree([row(10, 'my file.txt'), row('-', 'vendor/lib', 'commit')]))
  await session.run('size')
  const out = session.copied()[0] ?? ''
  expect(out).toContain('10 B  my file.txt')
  expect(out).not.toContain('vendor/lib')
  expect(out).toContain('in 1 file')
})

test('size: an empty repo says so and copies nothing', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  expect(await session.run('size')).toBe('No committed files yet.')
  expect(session.copied()).toEqual([])
})

test('size: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('size')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('size: output cut at the cap is reported, not half read', async ($, on) => {
  const session = probe($, on, { ...tree([row(1, 'a')]), truncated: [LS] })
  expect(await session.run('size')).toMatch(/^size: failed, git ls-tree output passed the 4 MiB cap/)
  expect(session.copied()).toEqual([])
})

test('size: only reads, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, tree([row(1, 'a')]))
  await session.run('size')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
})
