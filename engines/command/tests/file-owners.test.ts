import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

// -z: each path ends with a NUL and is never C-quoted.
const LS = (path: string) => `ls-files -z -- ${path}`
const BLAME = (file: string) => `blame --line-porcelain -- ${file}`

// Two source lines per name: porcelain repeats the author header for every line.
const blame = (...authors: string[]) =>
  authors.map((a, i) => `abc${i} ${i + 1} ${i + 1} 1\nauthor ${a}\nauthor-mail <${a.toLowerCase().replace(/\W/g, '')}@x.io>\nsummary s\n\tcode line ${i}`).join('\n') + '\n'

const repo = (files: Record<string, string>, path: string) => ({
  git: {
    ...IN_REPO,
    [LS(path)]: Object.keys(files).join('\0') + '\0',
    ...Object.fromEntries(Object.entries(files).map(([file, out]) => [BLAME(file), out])),
  },
})

test('owners: registers /owners and names its argument', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'owners')?.description).toMatch(/\/owners <path>/)
})

test('owners: top authors of a file by lines', async ($, on) => {
  const session = probe($, on, repo({ 'src/a.ts': blame('Ada', 'Ada', 'Ada', 'Grace', 'Grace', 'Alan') }, 'src/a.ts'))
  const text = await session.run('owners', 'src/a.ts')
  expect(text.startsWith(['Top authors of src/a.ts by lines (6 lines in 1 file)', '', '3 lines  Ada', '2 lines  Grace', '1 line  Alan'].join('\n'))).toBe(true)
})

test('owners: a folder sums its files and keeps only the top 5', async ($, on) => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  const files = { 'src/x.ts': blame(...names, 'A', 'A', 'B'), 'src/y.ts': blame('A', 'C') }
  const session = probe($, on, repo(files, 'src'))
  const text = await session.run('owners', 'src')
  expect(text).toContain('in 2 files')
  const rows = text.split('\n').filter(l => /^\d+ lines? {2}[A-G]$/.test(l))
  expect(rows).toEqual(['4 lines  A', '2 lines  B', '2 lines  C', '1 line  D', '1 line  E'])
  expect(text).not.toContain('  F')
})

test('owners: names only, never an address', async ($, on) => {
  const session = probe($, on, repo({ 'a.ts': 'h 1 1 1\nauthor Eve <eve@example.com>\n\tx\nh 2 2 1\nauthor bob@example.com\n\ty\n' }, 'a.ts'))
  const text = await session.run('owners', 'a.ts')
  expect(text + session.copied().join('')).not.toContain('@')
  expect(text).toContain('Eve')
})

test('owners: uncommitted lines are not attributed to anyone', async ($, on) => {
  const session = probe($, on, repo({ 'a.ts': blame('Not Committed Yet', 'Ada') }, 'a.ts'))
  const text = await session.run('owners', 'a.ts')
  expect(text).toContain('1 line  Ada')
  expect(text).not.toContain('Not Committed')
})

test('owners: a quoted path and a path starting with a dash are read as a path', async ($, on) => {
  const session = probe($, on, repo({ '-odd.ts': blame('Ada') }, '-odd.ts'))
  expect(await session.run('owners', '"-odd.ts"')).toContain('1 line  Ada')
  expect(session.ran()).toContain('git -C /repo ls-files -z -- -odd.ts')
})

test('owners: no argument shows usage and copies nothing', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  expect(await session.run('owners')).toBe('Usage: /owners <path>  (a file or a folder in this repo)')
  expect(session.copied()).toEqual([])
})

test('owners: an untracked or missing path says so', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LS('nope')]: '' } })
  expect(await session.run('owners', 'nope')).toBe('No tracked file or folder matches: nope')
})

test('owners: a file with no commit yet (blame fails) has nothing to attribute', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LS('new.ts')]: 'new.ts\n' } })
  expect(await session.run('owners', 'new.ts')).toBe('No committed lines to attribute in: new.ts')
})

test('owners: a blame cut at the cap leaves that file out and says so', async ($, on) => {
  const files = { 'big.ts': blame('Zed'), 'a.ts': blame('Ada') }
  const session = probe($, on, { ...repo(files, 'src'), truncated: [BLAME('big.ts')] })
  const text = await session.run('owners', 'src')
  expect(text).toContain('1 line  Ada')
  expect(text).not.toContain('Zed')
  expect(text).toContain('Left out 1 file that could not be blamed.')
})

test('owners: a folder past 40 files reads the first 40 and says so', async ($, on) => {
  const files = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`d/f${i}.ts`, blame('Ada')]))
  const session = probe($, on, repo(files, 'd'))
  const text = await session.run('owners', 'd')
  expect(text).toContain('Read the first 40 of 45 files.')
  expect(session.ran().filter(c => c.includes(' blame ')).length).toBe(40)
})

test('owners: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('owners', 'a.ts')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('owners: no credential reaches the text, and it only reads', async ($, on) => {
  const session = probe($, on, repo({ 'a.ts': blame(FAKE.github) }, 'a.ts'))
  const text = await session.run('owners', 'a.ts')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
  expect(text).not.toContain('—')
  expect(session.written()).toEqual({})
})

test('owners: a file with a non-ASCII name is blamed by its real name', async ($, on) => {
  const session = probe($, on, repo({ 'docs/café.txt': blame('Ada', 'Grace', 'Ada') }, 'docs'))
  const text = await session.run('owners', 'docs')
  expect(text.startsWith(['Top authors of docs by lines (3 lines in 1 file)', '', '2 lines  Ada', '1 line  Grace'].join('\n'))).toBe(true)
})
