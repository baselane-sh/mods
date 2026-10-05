import { expect, test } from 'claude-code/testing'

import { addLangs, extOf, readLangs } from '../hooks/exts'
import { probe } from './probe'

const bar = (n: number): string => '█'.repeat(n).padEnd(20)

test('langs: a file type is what follows the last dot of the name, lower case', () => {
  expect(extOf('/repo/src/app.ts')).toBe('ts')
  expect(extOf('/repo/src/App.TSX')).toBe('tsx')
  expect(extOf('/repo/archive.tar.gz')).toBe('gz')
  expect(extOf('/repo/Makefile')).toBe('(none)')
  expect(extOf('/repo/.gitignore')).toBe('(none)')
  expect(extOf('/repo/odd.')).toBe('(none)')
  expect(extOf('/repo/v1.2/notes')).toBe('(none)')
  expect(extOf('/repo/weird.名前')).toBe('(other)')
})

test('langs: the tally adds one per file and reads junk as nothing', () => {
  expect(addLangs({ ts: 2 }, ['/a.ts', '/b.md'])).toEqual({ ts: 3, md: 1 })
  expect(readLangs({ ts: 3, py: 'x', go: -1 })).toEqual({ ts: 3, py: 0, go: 0 })
  expect(readLangs('junk')).toEqual({})
})

test('langs: registers /langs with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered()).toContain('langs')
})

test('langs: files edited and written this session, by type, as bars; reads do not count', async ($, on) => {
  const session = probe($, on)
  await session.start()
  await session.edit('/repo/a.ts')
  await session.edit('/repo/b.ts')
  await session.edit('/repo/a.ts')
  await session.write('/repo/README.md')
  await session.write('/repo/Makefile')
  await session.edit('/repo/src/App.TSX')
  await session.read('/repo/c.py')
  await session.turn()
  expect(await session.run('langs')).toBe(
    [
      'Files Claude edited, by type, across sessions: 5 files',
      `.ts     TypeScript   ${bar(20)}  2`,
      `.md     Markdown     ${bar(10)}  1`,
      `.tsx    TSX          ${bar(10)}  1`,
      `(none)               ${bar(10)}  1`,
      '',
      'A file counts once in each session that edits it.',
    ].join('\n'),
  )
})

test('langs: counts add to what earlier sessions kept, and only types are stored', async ($, on) => {
  const session = probe($, on, { store: { langs: { py: 10, ts: 4, junk: 'x' } } })
  await session.start()
  await session.edit('/repo/secret-plan/a.py')
  await session.turn()
  const text = await session.run('langs')
  expect(text.split('\n')[0]).toBe('Files Claude edited, by type, across sessions: 15 files')
  expect(text).toContain(`.py     Python       ${bar(20)}  11`)
  expect(session.stored()['langs']).toEqual({ py: 11, ts: 4, junk: 0 })
  expect(JSON.stringify(session.stored())).not.toContain('secret-plan')
})

test('langs: the top 10 types are drawn, then a count of the rest', async ($, on) => {
  const langs = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`x${i}`, 12 - i]))
  const session = probe($, on, { store: { langs } })
  const lines = (await session.run('langs')).split('\n')
  expect(lines.filter(text => text.startsWith('.x'))).toHaveLength(10)
  expect(lines).toContain('+ 2 more types, 3 files')
})

test('langs: with nothing counted yet it says how files are counted', async ($, on) => {
  const session = probe($, on)
  expect(await session.run('langs')).toBe('No edited file counted yet. Each file Claude edits or writes counts at the end of a turn.')
})

test('langs: a file edited again in the same session counts once', async ($, on) => {
  const session = probe($, on)
  await session.edit('/repo/a.go')
  await session.turn()
  await session.edit('/repo/a.go')
  await session.turn()
  expect(session.stored()['langs']).toEqual({ go: 1 })
})
