import { expect, test } from 'claude-code/testing'

import { FAIL_WORD, probe } from './probe'

const narrated = (toasts: readonly string[]) => toasts.filter(text => text.startsWith('sports-narrator: '))

test('sports-narrator: off by default, so it asks the model nothing', async ($, on) => {
  const session = probe($, on)
  await session.write('src/app.ts')
  await session.bash('npm test')
  expect(narrated(await session.stop())).toEqual([])
  expect(session.asked()).toEqual([])
})

test('sports-narrator: enabled false asks the model nothing either', { options: { enabled: false } }, async ($, on) => {
  const session = probe($, on)
  await session.bash('npm test')
  expect(narrated(await session.stop())).toEqual([])
  expect(session.asked()).toEqual([])
})

test('sports-narrator: enabled, it toasts the model line at turn end', { options: { enabled: true } }, async ($, on) => {
  const session = probe($, on, 10, 'And Claude lunges for the test suite... it is GREEN!')
  await session.edit('src/app.ts')
  await session.bash('npm test')
  expect(narrated(await session.stop())).toEqual(['sports-narrator: And Claude lunges for the test suite... it is GREEN!'])
})

test('sports-narrator: asks the cheapest model, low effort, a short reply, a time limit', { options: { enabled: true } }, async ($, on) => {
  const session = probe($, on)
  await session.bash('npm test')
  await session.stop()
  const [request] = session.asked()
  expect(session.asked().length).toBe(1)
  expect(request?.model).toBe('haiku')
  expect(request?.effort).toBe('low')
  expect(request?.maxTokens).toBeLessThanOrEqual(100)
  expect(request?.timeoutMs).toBeGreaterThan(0)
})

test('sports-narrator: the prompt names what the turn did and what failed, not the arguments', { options: { enabled: true } }, async ($, on) => {
  const session = probe($, on)
  await session.edit('/repo/src/app.ts')
  await session.bash(`npm test --token=hunter2 ${FAIL_WORD}`)
  await session.stop()
  const prompt = session.asked()[0]?.prompt ?? ''
  expect(prompt).toContain('Edit app.ts')
  expect(prompt).toContain('Bash npm test')
  expect(prompt).toMatch(/failed/)
  expect(prompt).not.toContain('hunter2')
  expect(prompt).not.toContain('/repo/src')
})

test('sports-narrator: a turn with no tool calls is not narrated', { options: { enabled: true } }, async ($, on) => {
  const session = probe($, on)
  expect(narrated(await session.stop())).toEqual([])
  expect(session.asked()).toEqual([])
})

test('sports-narrator: each turn narrates only its own calls', { options: { enabled: true } }, async ($, on) => {
  const session = probe($, on)
  await session.edit('src/one.ts')
  await session.stop()
  await session.bash('ls')
  await session.stop()
  expect(session.asked()[1]?.prompt).not.toContain('one.ts')
})

for (const fake of ['empty-reply', 'aborted', 'api-error'] as const) {
  test(`sports-narrator: a model that does not answer (${fake}) leaves it silent`, { options: { enabled: true } }, async ($, on) => {
    const session = probe($, on, 10, fake)
    await session.bash('ls')
    expect(narrated(await session.stop())).toEqual([])
    expect(session.asked().length).toBe(1)
    // Silent by choice, not because the nudge threw on a reply with no text.
    expect(session.logs()).toEqual([])
  })
}

test('sports-narrator: a blank reply is silent', { options: { enabled: true } }, async ($, on) => {
  const blank = probe($, on, 10, '   \n ')
  await blank.bash('ls')
  expect(narrated(await blank.stop())).toEqual([])
})

test('sports-narrator: keeps the first line, trims quotes, and never shows an em-dash', { options: { enabled: true } }, async ($, on) => {
  const session = probe($, on, 10, '"Claude strides in \u2014 and scores!"\nA second line nobody asked for.')
  await session.bash('ls')
  const [line] = narrated(await session.stop())
  expect(line).toBe('sports-narrator: Claude strides in , and scores!')
})
