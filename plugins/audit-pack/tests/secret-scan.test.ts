import { expect, test } from 'claude-code/testing'

import { SECRET_VALUE_ERE } from '../hooks/patterns'
import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const GREP = `grep -n -I -o --null -E -e ${SECRET_VALUE_ERE}`
const hit = (path: string, line: number, text: string) => `${path}\0${line}\0${text}`
const found = (...rows: string[]) => ({ git: { ...IN_REPO, [GREP]: rows.join('\n') + '\n' } })

test('secret-scan: registers /secret-scan and says it never prints a value', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'secret-scan')?.description).toMatch(/never prints a value/i)
})

test('secret-scan: lists path and line numbers', async ($, on) => {
  const session = probe($, on, found(hit('config/prod.env', 4, FAKE.github), hit('config/prod.env', 9, FAKE.anthropic), hit('src/db.ts', 12, FAKE.postgres)))
  const text = await session.run('secret-scan')
  expect(text).toContain('Tracked files with secret-shaped text: 2')
  expect(text).toContain('config/prod.env  lines 4, 9')
  expect(text).toContain('src/db.ts  line 12')
})

test('secret-scan: never prints or copies a matched value', async ($, on) => {
  const session = probe($, on, found(hit('a.env', 1, FAKE.github), hit('b.ts', 2, FAKE.anthropic), hit('c.ts', 3, FAKE.postgres)))
  const text = await session.run('secret-scan')
  const everything = text + session.copied().join('\n')
  expect(session.copied().length).toBe(1)
  for (const value of Object.values(FAKE)) expect(everything).not.toContain(value)
  expect(everything).not.toContain('S3cretPass')
  expect(everything).not.toContain('abcdefghijklmnopqrstuvwxyz')
})

test('secret-scan: a path that itself holds a credential is redacted', async ($, on) => {
  const session = probe($, on, found(hit(`dump/${FAKE.github}.txt`, 1, FAKE.github)))
  const text = await session.run('secret-scan')
  expect(text).not.toContain(FAKE.github)
  expect(text).toContain('[REDACTED]')
})

test('secret-scan: a row that does not match the shape is dropped', async ($, on) => {
  const session = probe($, on, found(hit('a.ts', 1, 'ordinary words')))
  expect(await session.run('secret-scan')).toBe('No secret-shaped text found in tracked files.')
  expect(session.copied()).toEqual([])
})

test('secret-scan: no match (grep exit 1) says none found', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  expect(await session.run('secret-scan')).toBe('No secret-shaped text found in tracked files.')
})

test('secret-scan: a grep failure is never read as clean', async ($, on) => {
  const session = probe($, on, { git: IN_REPO, exit: { [GREP]: 2 } })
  expect(await session.run('secret-scan')).toMatch(/^secret-scan: failed, git grep failed \(exit 2\)/)
})

test('secret-scan: output cut at the cap is reported', async ($, on) => {
  const session = probe($, on, { ...found(hit('a', 1, FAKE.github)), truncated: [GREP] })
  expect(await session.run('secret-scan')).toMatch(/^secret-scan: failed, git grep output passed the 4 MiB cap/)
})

test('secret-scan: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('secret-scan')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('secret-scan: only reads, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, found(hit('a', 1, FAKE.github)))
  await session.run('secret-scan')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
})

test('secret-scan: two values on one line list that line once', async ($, on) => {
  const session = probe($, on, found(hit('b.txt', 1, FAKE.github), hit('b.txt', 1, FAKE.anthropic), hit('b.txt', 3, FAKE.github)))
  const text = await session.run('secret-scan')
  expect(text).toContain('b.txt  lines 1, 3')
  expect(text).not.toContain('1, 1')
})
