import { expect, test } from 'claude-code/testing'

import { MAX_BYTES, capBytes } from '../hooks/rules/beads-prime'
import { compose, ENGINE_SECTIONS, ourSection } from './probe'
import type { TestBody } from 'claude-code/testing'

type OnFn = Parameters<TestBody>[1]

type Answer = { exitCode: number; stdout: string } | 'missing'

// Stands in for the host's process.run: records each argv and answers as told.
const fakeBd = (on: OnFn, answer: Answer) => {
  let calls: (readonly string[])[] = []
  on('process.run', (_$, e) => {
    calls = [...calls, e.argv]
    if (answer === 'missing') throw new Error('spawn bd ENOENT')
    return { value: { ...answer, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return () => calls
}

const PRIME = '[bd prime] If this output is truncated by your host, read the full output.\n\n# Beads Workflow Context\n\nRun `bd ready` to find work.\n'

test('beads-prime: adds one section last, session scope, with the text of bd prime', async ($, on) => {
  const calls = fakeBd(on, { exitCode: 0, stdout: PRIME })
  const { sections, index, section, text } = await ourSection($, on, 'beads-prime')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
  expect(index).toBe(sections.length - 1)
  expect(section?.scope).toBe('session')
  expect(text).toContain('# Beads Workflow Context')
  expect(text).toContain('Run `bd ready` to find work.')
  expect(text).not.toContain('[bd prime]')
  expect(calls()).toEqual([['bd', 'prime']])
})

test('beads-prime: bd runs once per session, however often the prompt is composed', async ($, on) => {
  const calls = fakeBd(on, { exitCode: 0, stdout: PRIME })
  await compose($, on, ENGINE_SECTIONS, 3)
  expect(calls()).toHaveLength(1)
})

test('beads-prime: a folder with no project prints nothing and adds nothing', async ($, on) => {
  fakeBd(on, { exitCode: 0, stdout: '' })
  expect(await compose($, on)).toEqual(ENGINE_SECTIONS)
})

test('beads-prime: output of only whitespace or only the host notice adds nothing', async ($, on) => {
  fakeBd(on, { exitCode: 0, stdout: '[bd prime] note\n\n  \n' })
  expect(await compose($, on)).toEqual(ENGINE_SECTIONS)
})

test('beads-prime: a non-zero exit adds nothing, even with output', async ($, on) => {
  fakeBd(on, { exitCode: 1, stdout: 'no beads project found' })
  expect(await compose($, on)).toEqual(ENGINE_SECTIONS)
})

test('beads-prime: bd missing (the run rejects) adds nothing and is not retried', async ($, on) => {
  const calls = fakeBd(on, 'missing')
  expect(await compose($, on, ENGINE_SECTIONS, 2)).toEqual(ENGINE_SECTIONS)
  expect(calls()).toHaveLength(1)
})

test('beads-prime: a long output is cut at 8 KB with a note', async ($, on) => {
  fakeBd(on, { exitCode: 0, stdout: `${'line of text\n'.repeat(2000)}` })
  const { text } = await ourSection($, on, 'beads-prime')
  expect(text.length).toBeLessThan(MAX_BYTES + 200)
  expect(text.endsWith('[cut at 8 KB]')).toBe(true)
})

test('beads-prime: replaces a section with the same id and keeps the others', async ($, on) => {
  fakeBd(on, { exitCode: 0, stdout: PRIME })
  const sections = await compose($, on, [...ENGINE_SECTIONS, { id: 'beads-prime:style', text: 'old', scope: 'session' }])
  expect(sections.filter(section => section.id === 'beads-prime:style')).toHaveLength(1)
  expect(sections.at(-1)?.text).not.toBe('old')
  expect(sections.slice(0, ENGINE_SECTIONS.length)).toEqual(ENGINE_SECTIONS)
})

test('beads-prime: capBytes counts UTF-8 bytes and never splits a character', () => {
  expect(capBytes('abc', 3)).toEqual({ text: 'abc', isCut: false })
  expect(capBytes('abcd', 3)).toEqual({ text: 'abc', isCut: true })
  // 2-byte, 3-byte and 4-byte characters
  expect(capBytes('éé', 3)).toEqual({ text: 'é', isCut: true })
  expect(capBytes('日日', 5)).toEqual({ text: '日', isCut: true })
  expect(capBytes('😀😀', 7)).toEqual({ text: '😀', isCut: true })
  expect(capBytes('😀', 4)).toEqual({ text: '😀', isCut: false })
})
