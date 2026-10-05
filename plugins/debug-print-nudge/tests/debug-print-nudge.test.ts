import { expect, test } from 'claude-code/testing'

import { DEBUG_LINE } from '../hooks/rules/debug-print-nudge'
import { probe } from './probe'

test('debug-print-nudge: names the count of debug lines added', async ($, on) => {
  const session = probe($, on)
  await session.write('src/a.ts', 'console.log(x)\nconst a = 1\ndebugger')
  await session.write('src/b.py', 'print(x)')
  await session.write('src/c.rs', 'dbg!(x);')
  expect(await session.stop()).toEqual(['debug-print-nudge: 4 debug print lines added this turn. Remove before committing.'])
})

test('debug-print-nudge: one line reads in the singular and the next turn is quiet', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/a.ts', 'console.log(1)')
  expect(await session.stop()).toEqual(['debug-print-nudge: 1 debug print line added this turn. Remove before committing.'])
  expect(await session.stop()).toEqual([])
})

test('debug-print-nudge: quiet for clean code, docs and existing prints', async ($, on) => {
  const session = probe($, on)
  await session.write('src/a.ts', 'const a = 1')
  await session.write('docs/guide.md', 'use console.log(x) and print(x)')
  await session.edit('src/a.ts', 'console.log(1) // kept', 'console.log(1)')
  expect(await session.stop()).toEqual([])
})

test('debug-print-nudge: line pattern table', () => {
  for (const line of ['console.log("x")', '  print(x)', 'debugger;', 'dbg!(v)', 'x = 1; print(x)']) {
    expect({ line, hit: DEBUG_LINE.test(line) }).toEqual({ line, hit: true })
  }
  for (const line of ['blueprint(x)', 'doc.print(x)', '// debugger is handy', 'console.error(x)', 'const x = 1']) {
    expect({ line, hit: DEBUG_LINE.test(line) }).toEqual({ line, hit: false })
  }
})

test('debug-print-nudge: a Write over an existing file skips the prints it kept', async ($, on) => {
  const session = probe($, on)
  await session.write('src/a.ts', 'console.log(x)\nconst a = 2', 'console.log(x)\nconst a = 1')
  expect(await session.stop()).toEqual([])
})
