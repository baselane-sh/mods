import { expect, test } from 'claude-code/testing'

import { TYPE_CHECK } from '../hooks/rules/typecheck-nudge'
import { probe, DENY_WORD, FAIL_WORD } from './probe'

const NUDGE = (n: number) => `typecheck-nudge: ${n} TypeScript file${n === 1 ? '' : 's'} edited and no type check ran since. Run tsc or your typecheck script.`

test('typecheck-nudge: edited .ts and .tsx files give one toast naming the count', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/a.ts')
  await session.write('src/b.tsx')
  expect(await session.stop()).toEqual([NUDGE(2)])
})

test('typecheck-nudge: the same file edited twice counts once', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/a.ts')
  await session.edit('src/a.ts')
  expect(await session.stop()).toEqual([NUDGE(1)])
})

test('typecheck-nudge: quiet for other files and when nothing was edited', async ($, on) => {
  const session = probe($, on)
  expect(await session.stop()).toEqual([])
  await session.edit('src/a.js')
  await session.edit('README.md')
  await session.edit('src/a.py')
  expect(await session.stop()).toEqual([])
})

for (const command of ['npx tsc --noEmit', 'tsc -p .', 'vue-tsc --noEmit', 'npm run typecheck', 'pnpm run type-check', 'npm run build', 'cd app && yarn typecheck']) {
  test(`typecheck-nudge: ${command} after the last edit silences it`, async ($, on) => {
    const session = probe($, on)
    await session.edit('src/a.ts')
    await session.bash(command)
    expect(await session.stop()).toEqual([])
  })
}

test('typecheck-nudge: an edit after the check brings the nudge back', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/a.ts')
  await session.bash('npx tsc --noEmit')
  await session.edit('src/b.ts')
  expect(await session.stop()).toEqual([NUDGE(1)])
})

test('typecheck-nudge: a check that found errors still counts', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/a.ts')
  await session.bash(`tsc ${FAIL_WORD}`)
  expect(await session.stop()).toEqual([])
})

test('typecheck-nudge: a denied check does not count', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/a.ts')
  await session.bash(`tsc ${DENY_WORD}`)
  expect(await session.stop()).toEqual([NUDGE(1)])
})

test('typecheck-nudge: one toast per batch, a later turn starts clean', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/a.ts')
  await session.stop()
  expect(await session.stop()).toEqual([])
  await session.edit('src/b.ts')
  expect(await session.stop()).toEqual([NUDGE(1)])
})

test('typecheck-nudge: only a real check command matches', () => {
  for (const command of ['tsc', 'npx tsc --noEmit', 'npm run typecheck', 'next build', 'turbo run build']) {
    expect({ command, hit: TYPE_CHECK.test(command) }).toEqual({ command, hit: true })
  }
  for (const command of ['echo tsc', 'cat tsconfig.json', 'npm run test', 'grep typecheck package.json']) {
    expect({ command, hit: TYPE_CHECK.test(command) }).toEqual({ command, hit: false })
  }
})
