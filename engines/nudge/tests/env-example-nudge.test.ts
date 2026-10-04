import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

const NUDGE = (names: string, n = 1) => `env-example-nudge: new environment variable${n === 1 ? '' : 's'} not in .env.example: ${names}. Add ${n === 1 ? 'it' : 'them'} so others can set up the project.`
const EXAMPLE = 'DATABASE_URL=postgres://x\n# comment\nexport API_KEY=\nPORT=3000\n'

const REFS: [string, string][] = [
  ['src/a.ts', 'const k = process.env.STRIPE_KEY'],
  ['src/a.ts', 'const k = process.env["STRIPE_KEY"]'],
  ['app/a.py', 'k = os.environ["STRIPE_KEY"]'],
  ['app/a.py', 'k = os.getenv("STRIPE_KEY")'],
  ['app/a.py', "k = os.environ.get('STRIPE_KEY', '')"],
  ['src/a.ts', 'const k = Deno.env.get("STRIPE_KEY")'],
]

for (const [path, text] of REFS) {
  test(`env-example-nudge: ${text} is found`, async ($, on) => {
    const session = probe($, on)
    session.setEnvExample(EXAMPLE)
    await session.write(path, text)
    expect(await session.stop()).toEqual([NUDGE('STRIPE_KEY')])
  })
}

test('env-example-nudge: names already in .env.example stay quiet', async ($, on) => {
  const session = probe($, on)
  session.setEnvExample(EXAMPLE)
  await session.write('src/a.ts', 'process.env.DATABASE_URL\nprocess.env.API_KEY\nprocess.env.PORT')
  expect(await session.stop()).toEqual([])
})

test('env-example-nudge: a reference an edit only keeps is not new', async ($, on) => {
  const session = probe($, on)
  session.setEnvExample(EXAMPLE)
  await session.edit('src/a.ts', 'const k = process.env.NEW_ONE ?? 1', 'const k = process.env.NEW_ONE')
  expect(await session.stop()).toEqual([])
})

test('env-example-nudge: several names are listed once each, in order', async ($, on) => {
  const session = probe($, on)
  session.setEnvExample(EXAMPLE)
  await session.write('src/a.ts', 'process.env.B_VAR\nprocess.env.A_VAR\nprocess.env.B_VAR\nprocess.env.PORT')
  expect(await session.stop()).toEqual([NUDGE('B_VAR, A_VAR', 2)])
})

test('env-example-nudge: a later turn starts clean', async ($, on) => {
  const session = probe($, on)
  session.setEnvExample(EXAMPLE)
  await session.write('src/a.ts', 'process.env.NEW_ONE')
  await session.stop()
  expect(await session.stop()).toEqual([])
})

test('env-example-nudge: no .env.example means no nudge', async ($, on) => {
  const session = probe($, on)
  await session.write('src/a.ts', 'process.env.NEW_ONE')
  expect(await session.stop()).toEqual([])
  expect(session.reads()).toEqual([])
})

test('env-example-nudge: NODE_ENV and non-code files are ignored', async ($, on) => {
  const session = probe($, on)
  session.setEnvExample(EXAMPLE)
  await session.write('src/a.ts', 'process.env.NODE_ENV')
  await session.write('docs/setup.md', 'set process.env.DOC_ONLY')
  expect(await session.stop()).toEqual([])
})

test('env-example-nudge: it reads .env.example and nothing else', async ($, on) => {
  const session = probe($, on)
  session.setEnvExample(EXAMPLE)
  await session.write('src/a.ts', 'process.env.NEW_ONE')
  await session.stop()
  expect(session.reads()).toEqual(['.env.example'])
})

test('env-example-nudge: nothing is read on a turn with no new reference', async ($, on) => {
  const session = probe($, on)
  session.setEnvExample(EXAMPLE)
  await session.write('src/a.ts', 'const a = 1')
  await session.stop()
  expect(session.reads()).toEqual([])
})
