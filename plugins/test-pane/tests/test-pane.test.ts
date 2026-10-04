import { expect, test } from 'claude-code/testing'

import { parseRun, runnerOf } from '../hooks/rules/test-pane'
import { SURFACES, probe } from './probe'

const RULE = '─'.repeat(72)

// Captured from real runs in a scratch folder (vitest 3.2.6, bun 1.3.11,
// cargo, claude plugin test 2.1.288), each with a failing test.
const VITEST = `
 RUN  v3.2.6 /private/tmp/samples/vt

 ❯ math.test.mjs (4 tests | 2 failed | 1 skipped) 7ms
   ✓ math > adds 1ms
   × math > subtracts 5ms
     → expected 1 to be +0 // Object.is equality
   ↓ math > later
   × math > divides 1ms
     → expected 2 to be 3 // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  math.test.mjs > math > subtracts
AssertionError: expected 1 to be +0 // Object.is equality

 FAIL  math.test.mjs > math > divides
AssertionError: expected 2 to be 3 // Object.is equality

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed | 1 skipped (4)
   Start at  20:23:40
   Duration  379ms (transform 20ms, setup 0ms, collect 9ms, tests 7ms, environment 0ms, prepare 78ms)
`

const BUN = `bun test v1.3.11 (af24e281)

math.test.ts:
error: expect(received).toBe(expected)

Expected: 0
Received: 1

(fail) subtracts [2.83ms]

 2 pass
 1 skip
 1 fail
 3 expect() calls
Ran 4 tests across 1 file. [93.00ms]
`

const CARGO = `   Compiling sample v0.1.0 (/private/tmp/samples/cg)
    Finished \`test\` profile [unoptimized + debuginfo] target(s) in 5.15s
     Running unittests src/lib.rs (/private/tmp/samples/cg/target/debug/deps/sample-7881330be6b7fe3f)

running 4 tests
test tests::later ... ignored
test tests::multiplies ... ok
test tests::adds ... ok
test tests::subtracts ... FAILED

failures:

---- tests::subtracts stdout ----
assertion \`left == right\` failed

failures:
    tests::subtracts

test result: FAILED. 2 passed; 1 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s

error: test failed, to rerun pass \`--lib\`
`

const CLAUDE = `
tests/engine.test.ts:
(fail) firewall: each outcome is counted and the counters add up [70.33ms]
  AssertionError: expect(received).toBe()
(pass) firewall: a call passes through unchanged [50.44ms]

tests/view.test.ts:
(fail) the file did not load
  test.skip is not a function.

 10 pass
 2 fail
Ran 12 tests across 3 files. [0.81s]
`

// Written by hand from each runner's documented output (jest 29, pytest 8,
// go test): none of the three is installed here.
const JEST = `FAIL src/math.test.js
  math
    ✓ adds (2 ms)
    ✕ subtracts (3 ms)
    ○ skipped later
    ✓ multiplies

  ● math › subtracts

    expect(received).toBe(expected) // Object.is equality

  ● Console

    console.log
      hello

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 skipped, 2 passed, 4 total
Snapshots:   0 total
Time:        0.512 s, estimated 1 s
Ran all test suites.
`

const PYTEST = `============================= test session starts ==============================
platform darwin -- Python 3.12.4, pytest-8.3.2, pluggy-1.5.0
rootdir: /repo
collected 4 items

test_math.py .F.s                                                        [100%]

=================================== FAILURES ===================================
________________________________ test_subtract _________________________________
E       assert 1 == 0
=========================== short test summary info ============================
FAILED test_math.py::test_subtract - assert 1 == 0
=================== 1 failed, 2 passed, 1 skipped in 0.03s ====================
`

const GO_VERBOSE = `=== RUN   TestAdd
--- PASS: TestAdd (0.00s)
=== RUN   TestSubtract
    math_test.go:9: got 1, want 0
--- FAIL: TestSubtract (0.00s)
=== RUN   TestLater
--- SKIP: TestLater (0.00s)
=== RUN   TestTable
=== RUN   TestTable/one
    --- PASS: TestTable/one (0.00s)
--- PASS: TestTable (0.00s)
FAIL
FAIL	example.com/sample	0.002s
FAIL
`

const GO_QUIET = `ok  	example.com/sample/util	0.003s
--- FAIL: TestSubtract (0.00s)
    math_test.go:9: got 1, want 0
FAIL
FAIL	example.com/sample	0.002s
FAIL
`

test('test-pane parser: each runner sample gives its counts, duration and failing tests', () => {
  expect(parseRun(VITEST)).toEqual({
    format: 'vitest',
    pass: 1,
    fail: 2,
    skip: 1,
    durationMs: 379,
    failing: ['math.test.mjs > math > subtracts', 'math.test.mjs > math > divides'],
  })
  expect(parseRun(BUN)).toEqual({ format: 'bun test', pass: 2, fail: 1, skip: 1, durationMs: 93, failing: ['subtracts'] })
  expect(parseRun(CARGO)).toEqual({ format: 'cargo test', pass: 2, fail: 1, skip: 1, durationMs: 0, failing: ['tests::subtracts'] })
  expect(parseRun(CLAUDE)).toEqual({
    format: 'bun test',
    pass: 10,
    fail: 2,
    skip: 0,
    durationMs: 810,
    failing: ['firewall: each outcome is counted and the counters add up', 'the file did not load'],
  })
  expect(parseRun(JEST)).toEqual({ format: 'jest', pass: 2, fail: 1, skip: 1, durationMs: 512, failing: ['math › subtracts'] })
  expect(parseRun(PYTEST)).toEqual({
    format: 'pytest',
    pass: 2,
    fail: 1,
    skip: 1,
    durationMs: 30,
    failing: ['test_math.py::test_subtract'],
  })
  expect(parseRun(GO_VERBOSE)).toEqual({ format: 'go test', pass: 2, fail: 1, skip: 1, durationMs: 2, failing: ['TestSubtract'] })
})

test('test-pane parser: go without -v knows its failures but not its passes', () => {
  expect(parseRun(GO_QUIET)).toEqual({ format: 'go test', pass: null, fail: 1, skip: null, durationMs: 5, failing: ['TestSubtract'] })
})

test('test-pane parser: color codes do not hide the counts', () => {
  const colored = BUN.replace(' 2 pass', ' \u001b[32m2 pass\u001b[0m').replace(' 1 fail', ' \u001b[31m1 fail\u001b[0m')
  expect(parseRun(colored)?.pass).toBe(2)
  expect(parseRun(colored)?.fail).toBe(1)
})

test('test-pane parser: output it does not know gives no counts', () => {
  expect(parseRun('All good, 12 checks done.')).toBeUndefined()
  expect(parseRun('')).toBeUndefined()
})

test('test-pane parser: the runner is named from the command, else from the output', () => {
  expect(runnerOf('npx vitest run', 'vitest')).toBe('vitest')
  expect(runnerOf('claude plugin test plugins/git-pane', 'bun test')).toBe('claude plugin test')
  expect(runnerOf('uv run pytest -q', 'pytest')).toBe('pytest')
  expect(runnerOf('go test ./...', 'go test')).toBe('go test')
  expect(runnerOf('npm test', 'jest')).toBe('jest')
  expect(runnerOf('make test', undefined)).toBe('make test')
})

test('test-pane: /tests is registered and toggles a pane that Esc closes', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.commands()).toEqual(['tests'])
  expect((await session.command('tests')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'tests', title: 'Tests', closeOnEscape: true }])
  expect((await session.command('tests')).text).toContain('closed')
  expect(session.closes()).toEqual(['tests'])
  expect(session.runs()).toEqual([])
})

test('test-pane: the last run at 72 columns on every surface', async ($, on) => {
  const session = probe($, on)
  await session.bash('npm test', { text: VITEST, isError: true })
  await session.command('tests')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'tests', 72)
    expect((await ui.find({ key: 'header' }))?.text).toBe('Tests  updated 12:34:56')
    expect(await session.lines(ui)).toEqual([
      '✘ failed  vitest  npm test',
      '1 passed  2 failed  1 skipped  379 ms',
      RULE,
      'Failing tests',
      '✘ math.test.mjs > math > subtracts',
      '✘ math.test.mjs > math > divides',
    ])
    await ui.unmount()
  }
})

test('test-pane: a passing run is green and says so in words', async ($, on) => {
  const session = probe($, on)
  const passing = 'test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.25s\n'
  await session.bash('cargo test', { text: passing })
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'tests')
    expect(await session.lines(ui)).toEqual(['✔ passed  cargo test  cargo test', '3 passed  0 failed  0 skipped  250 ms'])
    const verdict = await ui.find({ type: 'Text', text: '✔ passed' })
    expect(verdict?.props.color).toBe('green')
    await ui.unmount()
  }
})

test('test-pane: failing tests count as failed even when the command exits 0', async ($, on) => {
  const session = probe($, on)
  await session.bash('npx vitest run | tee out.txt', { text: VITEST })
  const ui = await session.mount('terminal', 'tests')
  expect((await session.lines(ui))[0]).toBe('✘ failed  vitest  npx vitest run | tee out.txt')
  await ui.unmount()
})

test('test-pane: unknown output says ran, counts unknown, with the time the call took', async ($, on) => {
  const session = probe($, on)
  await session.bash('make test', { text: 'all checks done', tookMs: 1500 })
  const ui = await session.mount('terminal', 'tests')
  expect(await session.lines(ui)).toEqual(['? ran  make test', 'ran, counts unknown  1.5 s'])
  await ui.unmount()

  await session.bash('make test', { text: 'make: *** [test] Error 2', isError: true })
  const again = await session.mount('terminal', 'tests')
  expect((await session.lines(again))[0]).toBe('✘ exited with an error  make test')
  await again.unmount()
})

test('test-pane: only the first 5 failing tests are named', async ($, on) => {
  const session = probe($, on)
  const fails = Array.from({ length: 7 }, (_, n) => `(fail) case ${n + 1} [1.00ms]`).join('\n')
  await session.bash('bun test', { text: `${fails}\n\n 3 pass\n 7 fail\nRan 10 tests across 1 file. [12.00ms]\n`, isError: true })
  const ui = await session.mount('terminal', 'tests')
  const lines = await session.lines(ui)
  expect(lines.filter(text => text.startsWith('✘ case'))).toEqual(['✘ case 1', '✘ case 2', '✘ case 3', '✘ case 4', '✘ case 5'])
  expect(lines.at(-1)).toBe('… and 2 more')
  await ui.unmount()
})

test('test-pane: other commands and background runs leave the last run alone', async ($, on) => {
  const session = probe($, on)
  await session.bash('cargo test', { text: CARGO, isError: true })
  await session.bash('ls -la', { text: ' 4 pass\n' })
  await session.call({ tool: 'Bash', command: 'npm test', run_in_background: true }, { text: 'Command running in background with ID: b1' })
  await session.call({ tool: 'Read', file_path: '/repo/README.md' }, { text: VITEST })
  const ui = await session.mount('terminal', 'tests')
  expect((await session.lines(ui))[0]).toBe('✘ failed  cargo test  cargo test')
  await ui.unmount()
})

test('test-pane: before any run the pane says there is none', async ($, on) => {
  const session = probe($, on)
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'tests')
    expect((await ui.find({ key: 'empty' }))?.text).toBe('No test run yet. Run your tests and the result shows here.')
    expect(await session.lines(ui)).toEqual([])
    await ui.unmount()
  }
})

test('test-pane: lines fit narrow panes and credentials are redacted', async ($, on) => {
  const key = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789'
  const session = probe($, on)
  await session.bash(`npx jest --testNamePattern ${key}`, { text: JEST.replace('math › subtracts', `math › uses ${key}`), isError: true })
  for (const surface of SURFACES) {
    for (const columns of [200, 30, 12]) {
      const ui = await session.mount(surface, 'tests', columns)
      const lines = await session.lines(ui)
      for (const text of lines) expect({ surface, columns, text, fits: text.length <= columns }).toEqual({ surface, columns, text, fits: true })
      expect(lines.join('\n')).not.toContain(key.slice(0, 10))
      if (columns === 200) expect(lines.join('\n')).toContain('[REDACTED]')
      await ui.unmount()
    }
  }
})
