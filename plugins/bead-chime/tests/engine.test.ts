import { expect, test } from 'claude-code/testing'

import { settingsFrom } from '../hooks/engine'
import { TEST_RUNNER } from '../hooks/runner'

test('sound engine: unset options mean full volume and a turn-end sound', () => {
  expect(settingsFrom({})).toEqual({ gain: 1, quiet: false })
})

test('sound engine: options are read as given', () => {
  expect(settingsFrom({ volume: 1.5, quiet: true })).toEqual({ gain: 1.5, quiet: true })
  expect(settingsFrom({ volume: 0 })).toEqual({ gain: 0, quiet: false })
})

test('sound engine: a bad volume falls back to 1 and a large one is capped at 4', () => {
  expect(settingsFrom({ volume: -1 }).gain).toBe(1)
  expect(settingsFrom({ volume: 'loud' }).gain).toBe(1)
  expect(settingsFrom({ volume: 9 }).gain).toBe(4)
})

test('sound engine: runner table', () => {
  for (const command of ['npm test', 'pnpm run test', 'cd x && pytest -q', 'go test ./...', 'uv run pytest', 'claude plugin test plugins/x']) {
    expect({ command, runner: TEST_RUNNER.test(command) }).toEqual({ command, runner: true })
  }
  for (const command of ['cat jest.config.js', 'grep vitest package.json', 'npm install']) {
    expect({ command, runner: TEST_RUNNER.test(command) }).toEqual({ command, runner: false })
  }
})
