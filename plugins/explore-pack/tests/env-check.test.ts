import { expect, test } from 'claude-code/testing'

import { IN_REPO } from './fixtures'
import { probe } from './probe'

const ROOT = 'rev-parse --show-toplevel'
const git = { ...IN_REPO, [ROOT]: '/repo\n' }
const at = (contents: Readonly<Record<string, string>>) => ({ git, contents })

const EXAMPLE = ['# Example', 'API_URL=https://example.test', 'DB_HOST=', 'export TOKEN_NAME=changeme', 'SPACED = x', '', 'EMPTY'].join('\n')
const DOTENV = ['API_URL=https://real.example', 'EXTRA_ONE=1', '# COMMENTED=1', 'SPACED=y', 'ZED="two words"'].join('\n')

const EXPECTED = [
  'Env check: .env.example (4 names) against .env (4 names)',
  '',
  'Missing from .env (2)',
  '- DB_HOST',
  '- TOKEN_NAME',
  '',
  'Extra in .env (2)',
  '- EXTRA_ONE',
  '- ZED',
].join('\n')

test('env-check: registers /env-check with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'env-check')?.description).toMatch(/names/i)
})

test('env-check: lists missing and extra names, sorted', async ($, on) => {
  const session = probe($, on, at({ '/repo/.env.example': EXAMPLE, '/repo/.env': DOTENV }))
  const text = await session.run('env-check')
  expect(text.startsWith(EXPECTED)).toBe(true)
  expect(session.copied()).toEqual([EXPECTED])
})

test('env-check: a value never reaches the output or the clipboard', async ($, on) => {
  const secrets = ['hunter2-value', 'sk_live_abcdefghijklmnop', 'p@ss w0rd', 'https://real.example', 'changeme', 'two words']
  const example = ['PLAIN=changeme', 'URL=https://real.example'].join('\n')
  const dotenv = [
    'PASSWORD=hunter2-value',
    'STRIPE="sk_live_abcdefghijklmnop"',
    "PHRASE='p@ss w0rd'",
    'URL=https://real.example',
    'ZED="two words"',
    'hunter2-value-on-its-own-line',
    'not a name=sk_live_abcdefghijklmnop',
    '# NOTE=hunter2-value',
  ].join('\n')
  const session = probe($, on, at({ '/repo/.env.example': example, '/repo/.env': dotenv }))
  const text = await session.run('env-check')
  const everything = [text, ...session.copied()].join('\n')
  for (const secret of secrets) expect(everything).not.toContain(secret)
  expect(everything).not.toContain('=')
  expect(text).toContain('- PASSWORD')
  expect(text).toContain('- PHRASE')
  expect(text).toContain('- STRIPE')
  expect(text).toContain('- PLAIN')
  expect(session.written()).toEqual({})
})

test('env-check: falls back to .env.sample, then .env.template', async ($, on) => {
  const sample = probe($, on, at({ '/repo/.env.sample': 'A=1', '/repo/.env': 'A=2' }))
  expect(await sample.run('env-check')).toContain('.env.sample (1 name) against .env (1 name)')
})

test('env-check: reads .env.template when it is the only template', async ($, on) => {
  const session = probe($, on, at({ '/repo/.env.template': 'A=1\nB=2', '/repo/.env': 'A=2' }))
  const text = await session.run('env-check')
  expect(text).toContain('.env.template (2 names)')
  expect(text).toContain('Missing from .env (1)\n- B')
})

test('env-check: every name present says so', async ($, on) => {
  const session = probe($, on, at({ '/repo/.env.example': 'A=1\nB=2', '/repo/.env': 'B=x\nA=y' }))
  const text = await session.run('env-check')
  expect(text).toBe('Env check: .env.example (2 names) against .env (2 names)\n\nAll names are present, none extra.\n\ncopied to clipboard')
})

test('env-check: a missing .env means every name is missing', async ($, on) => {
  const session = probe($, on, at({ '/repo/.env.example': 'A=1\nB=2' }))
  const text = await session.run('env-check')
  expect(text).toContain('.env (not found)')
  expect(text).toContain('Missing from .env (2)\n- A\n- B')
})

test('env-check: no template says so and copies nothing', async ($, on) => {
  const session = probe($, on, at({ '/repo/.env': 'A=1' }))
  const text = await session.run('env-check')
  expect(text).toBe('No .env.example, .env.sample or .env.template at the repo root.')
  expect(session.copied()).toEqual([])
})

test('env-check: caps each list at 50 names', async ($, on) => {
  const names = Array.from({ length: 53 }, (_, i) => `VAR_${String(i).padStart(2, '0')}=x`).join('\n')
  const session = probe($, on, at({ '/repo/.env.example': names, '/repo/.env': '' }))
  await session.run('env-check')
  const text = session.copied()[0] ?? ''
  expect(text.split('\n').filter(l => l.startsWith('- VAR_')).length).toBe(50)
  expect(text).toContain('- and 3 more')
  expect(text).toContain('Missing from .env (53)')
})

test('env-check: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  const text = await session.run('env-check')
  expect(text).toMatch(/^Not a git repository: \/tmp\/plain/)
  expect(session.copied()).toEqual([])
})

test('env-check: only reads, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, at({ '/repo/.env.example': EXAMPLE, '/repo/.env': DOTENV }))
  await session.run('env-check')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
})
