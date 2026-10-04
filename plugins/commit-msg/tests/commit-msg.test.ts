import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const STAGED = 'diff --cached --name-status -M'

const staged = (rows: readonly string[]) => ({ git: { ...IN_REPO, [STAGED]: `${rows.join('\n')}\n` } })

const subject = (text: string): string => text.split('\n')[0] ?? ''

test('commit-msg: registers /commit-msg with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'commit-msg')?.description).toMatch(/Conventional/)
})

test('commit-msg: a new source file is a feat, scoped to its top folder, with a body', async ($, on) => {
  const session = probe($, on, staged(['A\tsrc/login.ts', 'M\tsrc/app.ts']))
  const expected = ['feat(src): update 2 files', '', '- added src/login.ts', '- modified src/app.ts'].join('\n')
  const text = await session.run('commit-msg')
  expect(text.startsWith(expected)).toBe(true)
  expect(session.copied()).toEqual([expected])
})

test('commit-msg: a single added file is named in the subject', async ($, on) => {
  const session = probe($, on, staged(['A\tsrc/login.ts']))
  await session.run('commit-msg')
  expect(subject(session.copied()[0] ?? '')).toBe('feat(src): add login.ts')
})

test('commit-msg: modified source only is a fix', async ($, on) => {
  const session = probe($, on, staged(['M\tlib/a.ts']))
  await session.run('commit-msg')
  expect(subject(session.copied()[0] ?? '')).toBe('fix(lib): update a.ts')
})

test('commit-msg: only documentation is docs, with no scope for a root file', async ($, on) => {
  const session = probe($, on, staged(['M\tREADME.md']))
  await session.run('commit-msg')
  expect(subject(session.copied()[0] ?? '')).toBe('docs: update README.md')
})

test('commit-msg: only tests is test, and tests beside source do not decide the type', async ($, on) => {
  const only = probe($, on, staged(['A\tsrc/a.test.ts', 'M\tsrc/b.spec.ts']))
  await only.run('commit-msg')
  expect(subject(only.copied()[0] ?? '')).toBe('test(src): update 2 files')
})

test('commit-msg: source with its tests keeps the source type and scope', async ($, on) => {
  const session = probe($, on, staged(['M\tsrc/a.ts', 'A\ttests/a.test.ts']))
  await session.run('commit-msg')
  expect(subject(session.copied()[0] ?? '')).toBe('fix(src): update a.ts')
})

test('commit-msg: workflow files are ci', async ($, on) => {
  const session = probe($, on, staged(['M\t.github/workflows/test.yml']))
  await session.run('commit-msg')
  expect(subject(session.copied()[0] ?? '')).toBe('ci: update test.yml')
})

test('commit-msg: manifests and lockfiles are build', async ($, on) => {
  const session = probe($, on, staged(['M\tpackage.json', 'M\tpackage-lock.json']))
  await session.run('commit-msg')
  expect(subject(session.copied()[0] ?? '')).toBe('build: update 2 files')
})

test('commit-msg: source in several folders has no scope', async ($, on) => {
  const session = probe($, on, staged(['M\tsrc/a.ts', 'M\tlib/b.ts']))
  await session.run('commit-msg')
  expect(subject(session.copied()[0] ?? '')).toBe('fix: update 2 files')
})

test('commit-msg: deleting reads as remove', async ($, on) => {
  const session = probe($, on, staged(['D\tsrc/old.ts']))
  await session.run('commit-msg')
  expect(subject(session.copied()[0] ?? '')).toBe('refactor(src): remove old.ts')
})

test('commit-msg: renaming reads as rename and names both paths', async ($, on) => {
  const session = probe($, on, staged(['R100\tsrc/a.ts\tsrc/b.ts']))
  await session.run('commit-msg')
  expect(session.copied()[0] ?? '').toContain('- renamed src/a.ts to src/b.ts')
  expect(subject(session.copied()[0] ?? '')).toBe('refactor(src): rename b.ts')
})

test('commit-msg: the subject is under 72 characters', async ($, on) => {
  const long = `src/${'x'.repeat(100)}.ts`
  const session = probe($, on, staged([`A\t${long}`]))
  await session.run('commit-msg')
  expect(subject(session.copied()[0] ?? '').length).toBeLessThan(72)
  expect(session.copied()[0] ?? '').toContain(`- added ${long}`)
})

test('commit-msg: the body lists 20 files and counts the rest', async ($, on) => {
  const session = probe($, on, staged(Array.from({ length: 23 }, (_, i) => `M\tsrc/f${i}.ts`)))
  await session.run('commit-msg')
  const text = session.copied()[0] ?? ''
  expect(text.split('\n').filter(l => l.startsWith('- modified')).length).toBe(20)
  expect(text).toContain('- and 3 more')
})

test('commit-msg: nothing staged says so and copies nothing', async ($, on) => {
  const session = probe($, on, staged([]))
  const text = await session.run('commit-msg')
  expect(text).toBe('Nothing is staged. Run git add on the files first.')
  expect(session.copied()).toEqual([])
})

test('commit-msg: an empty repo with nothing staged says so', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  expect(await session.run('commit-msg')).toMatch(/^Nothing is staged/)
})

test('commit-msg: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('commit-msg')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('commit-msg: output cut at the cap is reported', async ($, on) => {
  const session = probe($, on, { ...staged(['M\ta.ts']), truncated: [STAGED] })
  expect(await session.run('commit-msg')).toMatch(/^commit-msg: failed, git diff output passed the 4 MiB cap/)
})

test('commit-msg: no credential reaches the text', async ($, on) => {
  const session = probe($, on, staged([`A\tsrc/${FAKE.github}.ts`]))
  const text = await session.run('commit-msg')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
})

test('commit-msg: the text has no em-dashes', async ($, on) => {
  const session = probe($, on, staged(['A\tsrc/a.ts']))
  await session.run('commit-msg')
  expect(session.copied()[0] ?? '').not.toContain('\u2014')
})
