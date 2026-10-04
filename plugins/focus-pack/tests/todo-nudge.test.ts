import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

test('todo-nudge: names the count of marker lines added this turn', async ($, on) => {
  const session = probe($, on)
  await session.write('src/a.ts', '// TODO one\nconst a = 1\n// FIXME two\n// HACK three')
  expect(await session.stop()).toEqual(['todo-nudge: 3 TODO/FIXME/HACK lines added this turn. Resolve or track them.'])
})

test('todo-nudge: one line reads in the singular', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/a.ts', 'x // TODO later')
  expect(await session.stop()).toEqual(['todo-nudge: 1 TODO/FIXME/HACK line added this turn. Resolve or track them.'])
})

test('todo-nudge: quiet with no markers, and a later turn starts from zero', async ($, on) => {
  const session = probe($, on)
  await session.write('src/a.ts', 'const a = 1')
  expect(await session.stop()).toEqual([])
  await session.edit('src/a.ts', '// TODO x')
  expect((await session.stop()).length).toBe(1)
  expect(await session.stop()).toEqual([])
})

test('todo-nudge: an edit that keeps an existing marker adds none', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/a.ts', '// TODO keep, reworded', '// TODO keep')
  expect(await session.stop()).toEqual([])
})

test('todo-nudge: a word that only contains the marker does not count', async ($, on) => {
  const session = probe($, on)
  await session.write('src/a.ts', 'const TODOS = []\nconst hackathon = 1')
  expect(await session.stop()).toEqual([])
})

test('todo-nudge: a Write over an existing file counts only the markers it added', async ($, on) => {
  const session = probe($, on)
  await session.write('src/a.ts', '// TODO old\nconst a = 2', '// TODO old\nconst a = 1')
  expect(await session.stop()).toEqual([])
  await session.write('src/a.ts', '// TODO old\nconst a = 2\n// FIXME new', '// TODO old\nconst a = 2')
  expect(await session.stop()).toEqual(['todo-nudge: 1 TODO/FIXME/HACK line added this turn. Resolve or track them.'])
})
