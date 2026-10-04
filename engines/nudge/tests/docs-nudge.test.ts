import { expect, test } from 'claude-code/testing'

import { isDocsFile } from '../hooks/rules/docs-nudge'
import { probe } from './probe'

const NUDGE = 'docs-nudge: Exported code changed but no README or docs file was edited this session. Check the docs.'

test('docs-nudge: an added export without a docs edit gives one toast', async ($, on) => {
  const session = probe($, on)
  await session.write('src/api.ts', 'export const run = () => 1')
  expect(await session.stop()).toEqual([NUDGE])
  expect(await session.stop()).toEqual([])
})

test('docs-nudge: public signatures in other languages count', async ($, on) => {
  const session = probe($, on)
  await session.write('app/api.py', 'def fetch(x):\n  pass')
  expect(await session.stop()).toEqual([NUDGE])
  await session.write('app/api.go', 'func Fetch(x int) int {')
  expect(await session.stop()).toEqual([NUDGE])
})

test('docs-nudge: private code, tests and non-code edits stay quiet', async ($, on) => {
  const session = probe($, on)
  await session.write('app/api.py', 'def _helper(x):\n  pass')
  await session.write('app/api.go', 'func helper(x int) int {')
  await session.write('src/a.ts', 'const a = 1')
  await session.write('src/a.test.ts', 'export const t = 1')
  await session.write('notes.txt', 'export const x')
  expect(await session.stop()).toEqual([])
})

test('docs-nudge: a README edit before the export keeps it quiet', async ($, on) => {
  const session = probe($, on)
  await session.write('README.md', '# Docs')
  await session.write('src/api.ts', 'export const run = () => 1')
  expect(await session.stop()).toEqual([])
})

test('docs-nudge: a docs edit later in the same turn keeps it quiet', async ($, on) => {
  const session = probe($, on)
  await session.write('src/api.ts', 'export const run = () => 1')
  await session.write('docs/api.md', 'run')
  expect(await session.stop()).toEqual([])
})

test('docs-nudge: an edit that keeps an existing export adds none', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/api.ts', 'export const run = () => 2', 'export const run = () => 1')
  expect(await session.stop()).toEqual([])
})

test('docs-nudge: docs path table', () => {
  for (const path of ['README.md', 'pkg/readme.rst', 'docs/a.md', 'a/doc/b.txt']) {
    expect({ path, docs: isDocsFile(path) }).toEqual({ path, docs: true })
  }
  for (const path of ['src/a.ts', 'notes.md', 'mydocs/a.md']) {
    expect({ path, docs: isDocsFile(path) }).toEqual({ path, docs: false })
  }
})
