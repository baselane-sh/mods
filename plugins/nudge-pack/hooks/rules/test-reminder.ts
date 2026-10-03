import type { Nudge } from '../engine'

// One reminder at turn end when source files changed but no test command ran
// since. Test runners count only in command position, so `cat jest.config.js`
// or `grep vitest` never count as a test run.
const START = '(^|[;&|] *)((npx|bunx|pnpm exec|yarn|uv run|poetry run|bundle exec) +)?'
const RUNNERS =
  '((npm|pnpm|yarn|bun) +(run +)?test|vitest|jest|mocha|pytest|python3? +-m +(pytest|unittest)|go +test|cargo +test|rspec|phpunit|mvn +(test|verify)|gradle +test|dotnet +test|ctest|make +(test|check)|bash +tests?/run\\.sh|tests?/run\\.sh|claude +plugin +test)'
export const TEST_RUNNER = new RegExp(`${START}${RUNNERS}( |$)`, 'm')

const NOT_SOURCE = new Set(['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'lock', 'csv'])

export const isSource = (path: string): boolean => {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 && !NOT_SOURCE.has(name.slice(dot + 1).toLowerCase())
}

export const REMINDER =
  'Source files changed this session but no test command has run since. Run the test suite before calling this done.'

// Counts tool calls so "tested since the last edit" is an order, not a clock.
export const create = (): Nudge => {
  let step = 0
  let editedAt = 0
  let testedAt = 0

  return {
    id: 'test-reminder',
    observe: e => {
      step += 1
      if ((e.tool === 'Write' || e.tool === 'Edit') && isSource(e.file_path)) editedAt = step
      if (e.tool === 'Bash' && TEST_RUNNER.test(e.command)) testedAt = step
    },
    atStop: () => {
      if (editedAt === 0 || testedAt > editedAt) return undefined
      editedAt = 0 // one reminder per batch of edits
      return REMINDER
    },
  }
}
