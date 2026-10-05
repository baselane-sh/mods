import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

const ANSWERS = {
  'uname -srm': 'Darwin 25.2.0 arm64\n',
  'git --version': 'git version 2.50.1\n',
  'node --version': 'v22.1.0\n',
  'npm --version': '10.5.0\n',
  'python3 --version': 'Python 3.12.3\n',
  'go version': 'go version go1.22.1 darwin/arm64\n',
  'rustc --version': 'rustc 1.78.0 (abc 2026-05-01)\n',
  'docker --version': 'Docker version 26.1.0, build 1\n',
}

test('envinfo: registers /envinfo with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'envinfo')?.description).toMatch(/versions/i)
})

test('envinfo: prints the OS and every version', async ($, on) => {
  const session = probe($, on, { git: ANSWERS })
  const text = await session.run('envinfo')
  expect(text).toContain('os       Darwin 25.2.0 arm64')
  expect(text).toContain('git      git version 2.50.1')
  expect(text).toContain('node     v22.1.0')
  expect(text).toContain('npm      10.5.0')
  expect(text).toContain('python3  Python 3.12.3')
  expect(text).toContain('go       go version go1.22.1 darwin/arm64')
  expect(text).toContain('rustc    rustc 1.78.0')
  expect(text).toContain('docker   Docker version 26.1.0')
})

test('envinfo: a program that is not installed says so', async ($, on) => {
  const { 'go version': _go, 'docker --version': _docker, ...rest } = ANSWERS
  const session = probe($, on, { git: rest })
  const text = await session.run('envinfo')
  expect(text).toContain('go       not installed')
  expect(text).toContain('docker   not installed')
  expect(text).toContain('node     v22.1.0')
})

test('envinfo: a program that hangs is reported and the rest still print', async ($, on) => {
  const session = probe($, on, { git: ANSWERS, timeout: ['docker --version'] })
  const text = await session.run('envinfo')
  expect(text).toContain('docker   timed out (2 s)')
  expect(text).toContain('git      git version 2.50.1')
})

test('envinfo: asks each program for its version only, and works outside a repo', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain', git: ANSWERS })
  const text = await session.run('envinfo')
  expect(text).not.toMatch(/Not a git repository/)
  expect([...session.ran()].sort()).toEqual(Object.keys(ANSWERS).sort())
})

test('envinfo: a missing OS answer shows unknown, empty output shows unknown', async ($, on) => {
  const { 'uname -srm': _os, ...rest } = ANSWERS
  const session = probe($, on, { git: { ...rest, 'npm --version': '\n' } })
  const text = await session.run('envinfo')
  expect(text).toContain('os       unknown')
  expect(text).toContain('npm      unknown')
})

test('envinfo: only reads, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, { git: ANSWERS })
  await session.run('envinfo')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
})
