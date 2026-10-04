import type { PaneLine } from '../../types'
import { clean, durationText, line, ruleLine } from '../lines'
import type { Observed, PaneRule } from '../rule'

// The last test run, read from the Bash result of a test-runner command.
// Test runners count only in command position, as in the test-reminder nudge.
const START = '(^|[;&|] *)((npx|bunx|pnpm exec|yarn|uv run|poetry run|bundle exec) +)?'
const RUNNERS =
  '((npm|pnpm|yarn|bun) +(run +)?test|vitest|jest|mocha|pytest|python3? +-m +(pytest|unittest)|go +test|cargo +test|rspec|phpunit|mvn +(test|verify)|gradle +test|dotnet +test|ctest|make +(test|check)|bash +tests?/run\\.sh|tests?/run\\.sh|claude +plugin +test)'
export const TEST_RUNNER = new RegExp(`${START}${RUNNERS}( |$)`, 'm')

const MAX_FAILING = 5

// A count is null where the runner's output does not say it (go test
// without -v prints no passes).
export type RunCounts = {
  format: string
  pass: number | null
  fail: number | null
  skip: number | null
  durationMs?: number
  failing: string[]
}

const toMs = (value: string, unit: string): number => Math.round(Number(value) * (unit === 's' ? 1000 : 1))

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

const all = (text: string, pattern: RegExp): RegExpExecArray[] => [...text.matchAll(pattern)]

const unique = (names: readonly string[]): string[] => [...new Set(names.map(name => name.trim()).filter(name => name.length > 0))]

// The number before `word` in a summary such as "2 failed | 1 passed".
const countOf = (summary: string, words: string): number => {
  const match = new RegExp(`(\\d+) (?:${words})\\b`).exec(summary)
  return match === null ? 0 : Number(match[1])
}

const vitest = (text: string): RunCounts | undefined => {
  const summary = /^\s*Tests\s+(.+\(\d+\))\s*$/m.exec(text)?.[1]
  if (summary === undefined || !/^\s*Test Files\s/m.test(text)) return undefined
  const duration = /^\s*Duration\s+([\d.]+)(ms|s)\b/m.exec(text)
  return {
    format: 'vitest',
    pass: countOf(summary, 'passed'),
    fail: countOf(summary, 'failed'),
    skip: countOf(summary, 'skipped|todo'),
    ...(duration === null ? {} : { durationMs: toMs(duration[1] ?? '0', duration[2] ?? 'ms') }),
    failing: unique(all(text, /^\s*FAIL\s+(.+)$/gm).map(match => match[1] ?? '')),
  }
}

const jest = (text: string): RunCounts | undefined => {
  const summary = /^Tests:\s+(.+)$/m.exec(text)?.[1]
  if (summary === undefined) return undefined
  const duration = /^Time:\s+([\d.]+)\s*(ms|s)\b/m.exec(text)
  return {
    format: 'jest',
    pass: countOf(summary, 'passed'),
    fail: countOf(summary, 'failed'),
    skip: countOf(summary, 'skipped|todo'),
    ...(duration === null ? {} : { durationMs: toMs(duration[1] ?? '0', duration[2] ?? 's') }),
    failing: unique(all(text, /^\s*● (.+)$/gm).map(match => match[1] ?? '')).filter(name => name !== 'Console'),
  }
}

// bun test, and claude plugin test, which prints the same summary.
const bun = (text: string): RunCounts | undefined => {
  const passes = all(text, /^\s*(\d+) pass\s*$/gm)
  const fails = all(text, /^\s*(\d+) fail\s*$/gm)
  if (passes.length === 0 && fails.length === 0) return undefined
  const durations = all(text, /^Ran \d+ tests? across \d+ files?\. \[([\d.]+)(ms|s)\]/gm)
  return {
    format: 'bun test',
    pass: sum(passes.map(match => Number(match[1]))),
    fail: sum(fails.map(match => Number(match[1]))),
    skip: sum(all(text, /^\s*(\d+) skip\s*$/gm).map(match => Number(match[1]))),
    ...(durations.length === 0 ? {} : { durationMs: sum(durations.map(match => toMs(match[1] ?? '0', match[2] ?? 'ms'))) }),
    failing: unique(all(text, /^\(fail\) (.+?)(?: \[[\d.]+m?s\])?\s*$/gm).map(match => match[1] ?? '')),
  }
}

// One "test result:" line per test binary (unit, integration, doc); summed.
const cargo = (text: string): RunCounts | undefined => {
  const results = all(text, /^test result: \w+\. (\d+) passed; (\d+) failed; (\d+) ignored;.*finished in ([\d.]+)s/gm)
  if (results.length === 0) return undefined
  return {
    format: 'cargo test',
    pass: sum(results.map(match => Number(match[1]))),
    fail: sum(results.map(match => Number(match[2]))),
    skip: sum(results.map(match => Number(match[3]))),
    durationMs: sum(results.map(match => toMs(match[4] ?? '0', 's'))),
    failing: unique(all(text, /^test (\S+) \.\.\. FAILED\s*$/gm).map(match => match[1] ?? '')),
  }
}

const pytest = (text: string): RunCounts | undefined => {
  const lines = text.split('\n').filter(each => /\b\d+ (passed|failed|errors?|skipped)\b.* in [\d.]+s/.test(each))
  const summary = lines.at(-1)
  if (summary === undefined) return undefined
  const duration = / in ([\d.]+)s\b/.exec(summary)
  return {
    format: 'pytest',
    pass: countOf(summary, 'passed'),
    fail: countOf(summary, 'failed') + countOf(summary, 'errors?'),
    skip: countOf(summary, 'skipped'),
    ...(duration === null ? {} : { durationMs: toMs(duration[1] ?? '0', 's') }),
    failing: unique(all(text, /^(?:FAILED|ERROR) (\S+)/gm).map(match => match[1] ?? '')),
  }
}

// Top-level tests only: a subtest's line is indented.
const goTest = (text: string): RunCounts | undefined => {
  const packages = all(text, /^(?:ok|FAIL)\s+\S+\s+([\d.]+)s\s*$/gm)
  const results = all(text, /^--- (PASS|FAIL|SKIP): (\S+)/gm)
  if (packages.length === 0 && results.length === 0) return undefined
  const named = (kind: string) => results.filter(match => match[1] === kind)
  const isVerbose = /^=== RUN /m.test(text)
  return {
    format: 'go test',
    pass: isVerbose ? named('PASS').length : null,
    fail: named('FAIL').length,
    skip: isVerbose ? named('SKIP').length : null,
    ...(packages.length === 0 ? {} : { durationMs: sum(packages.map(match => toMs(match[1] ?? '0', 's'))) }),
    failing: unique(named('FAIL').map(match => match[2] ?? '')),
  }
}

const PARSERS = [cargo, vitest, jest, bun, pytest, goTest]

// Color codes and carriage returns out first: both split a summary line.
export const parseRun = (output: string): RunCounts | undefined => {
  const text = output.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '')
  for (const parse of PARSERS) {
    const counts = parse(text)
    if (counts !== undefined) return counts
  }
  return undefined
}

const NAMED: readonly (readonly [RegExp, string])[] = [
  [/\bclaude +plugin +test\b/, 'claude plugin test'],
  [/\bvitest\b/, 'vitest'],
  [/\bjest\b/, 'jest'],
  [/\bpytest\b/, 'pytest'],
  [/\bgo +test\b/, 'go test'],
  [/\bcargo +test\b/, 'cargo test'],
  [/\bbun +test\b/, 'bun test'],
]

// The runner the command names, else the one whose output it printed, else
// the command's own runner words (`npm test`, `make test`).
export const runnerOf = (command: string, format: string | undefined): string => {
  const runner = TEST_RUNNER.exec(command)?.[4] ?? command
  const named = NAMED.find(([pattern]) => pattern.test(runner))
  return named?.[1] ?? format ?? runner.trim()
}

const COUNT_COLOR = { passed: 'green', failed: 'red', skipped: 'yellow' } as const

const countCell = (count: number | null, word: keyof typeof COUNT_COLOR, gap: string) => ({
  text: `${gap}${count === null ? '?' : count} ${word}`,
  ...(count !== null && count > 0 ? { color: COUNT_COLOR[word] } : {}),
})

const runLines = ({ ran, durationMs }: Observed, command: string): PaneLine[] => {
  const output = ran.text ?? ''
  const isError = ran.isError === true
  const counts = parseRun(output)
  const runner = runnerOf(command, counts?.format)
  const took = durationText(counts?.durationMs ?? durationMs)
  const shown = clean(command)
  if (counts === undefined) {
    const verdict = isError ? { text: '✘ exited with an error', color: 'red', bold: true } : { text: '? ran', color: 'yellow', bold: true }
    return [line('verdict', verdict, { text: `  ${shown}`, dim: true }), line('counts', { text: 'ran, counts unknown' }, { text: `  ${took}`, dim: true })]
  }
  const failed = (counts.fail ?? 0) > 0 || isError
  const rest = counts.failing.length - MAX_FAILING
  return [
    line(
      'verdict',
      failed ? { text: '✘ failed', color: 'red', bold: true } : { text: '✔ passed', color: 'green', bold: true },
      { text: `  ${runner}`, bold: true },
      { text: `  ${shown}`, dim: true },
    ),
    line(
      'counts',
      countCell(counts.pass, 'passed', ''),
      countCell(counts.fail, 'failed', '  '),
      countCell(counts.skip, 'skipped', '  '),
      { text: `  ${took}`, dim: true },
    ),
    ...(counts.failing.length === 0
      ? []
      : [
          ruleLine('rule-failing'),
          line('failing', { text: 'Failing tests', bold: true }),
          ...counts.failing.slice(0, MAX_FAILING).map((name, index) => line(`fail-${index}`, { text: '✘ ', color: 'red' }, { text: clean(name) })),
          ...(rest > 0 ? [line('failing-more', { text: `… and ${rest} more`, dim: true })] : []),
        ]),
  ]
}

export const rule: PaneRule = {
  id: 'test-pane',
  pane: {
    id: 'tests',
    title: 'Tests',
    command: 'tests',
    description: 'Show or hide the Tests pane: the last test run, its counts and failing tests',
    empty: 'No test run yet. Run your tests and the result shows here.',
  },
  // A background run answers with a notice, not the runner's output.
  observe: call => {
    const { e } = call
    if (e.tool !== 'Bash' || e.run_in_background === true || !TEST_RUNNER.test(e.command)) return undefined
    return runLines(call, e.command)
  },
}
