import { expect, test } from 'claude-code/testing'

import { isSource, REMINDER, TEST_RUNNER } from '../hooks/rules/test-reminder'
import { probe } from './probe'

const REMINDED = `test-reminder: ${REMINDER}`

test('test-reminder: reminds once after a source edit with no test run', async ($, on) => {
  const session = probe($, on)
  await session.write('src/app.ts')
  expect(await session.stop()).toContain(REMINDED)
  expect(await session.stop()).not.toContain(REMINDED)
})

test('test-reminder: a test run after the edit keeps it quiet', async ($, on) => {
  const session = probe($, on)
  await session.write('src/app.ts')
  await session.bash('npm test')
  expect(await session.stop()).not.toContain(REMINDED)
})

test('test-reminder: an edit after the test run reminds again', async ($, on) => {
  const session = probe($, on)
  await session.bash('npx vitest run')
  await session.write('src/app.ts')
  expect(await session.stop()).toContain(REMINDED)
})

test('test-reminder: docs and config edits do not count', async ($, on) => {
  const session = probe($, on)
  await session.write('README.md')
  await session.write('package.json')
  expect(await session.stop()).not.toContain(REMINDED)
})

test('test-reminder: runner and source tables', () => {
  for (const command of ['npm test', 'pnpm run test', 'cd x && pytest -q', 'go test ./...', 'uv run pytest', 'bash tests/run.sh']) {
    expect({ command, runner: TEST_RUNNER.test(command) }).toEqual({ command, runner: true })
  }
  for (const command of ['cat jest.config.js', 'grep vitest package.json', 'npm install']) {
    expect({ command, runner: TEST_RUNNER.test(command) }).toEqual({ command, runner: false })
  }
  expect([isSource('a/b.ts'), isSource('a/b.md'), isSource('Makefile'), isSource('x.yml')]).toEqual([true, false, false, false])
})
