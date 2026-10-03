import { expect, test } from 'claude-code/testing'

import { FAKE } from './fixtures'
import { DENY_WORD, FAIL_WORD, probe } from './probe'

const MINUTE = 60_000
const LAST_LINE = 'made with Claude Code + baselane.sh'

// A session with a known shape: 5 Bash (1 denied so 4 ran, 1 errored), 2 Edit, 1 Write
// over two files, 4 Read. 12 calls.
const busySession = async (session: ReturnType<typeof probe>) => {
  await session.bash('npm test')
  await session.bash('ls')
  await session.bash(`${FAKE.github}`)
  await session.bash(`${DENY_WORD} rm`)
  await session.bash(`${FAIL_WORD} false`)
  await session.edit('/repo/a.ts')
  await session.edit('/repo/a.ts')
  await session.write('/repo/b.ts')
  for (const file of ['/r/1', '/r/2', '/r/3', '/r/4']) await session.read(file)
}

test('receipt: registers /receipt with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().map(c => c.name)).toContain('receipt')
  expect(session.registered().find(c => c.name === 'receipt')?.description).toMatch(/receipt/i)
})

test('receipt: counts, session length, turns, context and cost', async ($, on) => {
  const session = probe($, on, { turns: 14, startedAt: 0, now: 72 * MINUTE, percent: 42.4, usd: 3.176 })
  await busySession(session)
  const text = await session.run('receipt')
  expect(text).toMatch(/session length\s+1h 12m/)
  expect(text).toMatch(/turns\s+14\n/)
  expect(text).toMatch(/TOOL CALLS\s+12\n/)
  expect(text).toMatch(/Read\s+4\n/)
  expect(text).toMatch(/Bash\s+5\n/)
  expect(text).toMatch(/Edit\s+2\n/)
  expect(text).toMatch(/files touched\s+2\n/)
  expect(text).toMatch(/commands run\s+4\n/)
  expect(text).toMatch(/blocked\s+1\n/)
  expect(text).toMatch(/errors\s+1\n/)
  expect(text).toMatch(/context used\s+42%\n/)
  expect(text).toMatch(/cost\s+\$3\.18\n/)
})

test('receipt: shows only the top tools and rolls up the rest', async ($, on) => {
  const session = probe($, on)
  for (const tool of ['A', 'B', 'C', 'D', 'E', 'F']) await $.tool.call({ tool, x: 1 } as never)
  const text = await session.run('receipt')
  expect(text).toMatch(/other \(2 tools\)\s+2\n/)
})

test('receipt: says n/a, never a made-up figure, when cost and context are absent', async ($, on) => {
  const session = probe($, on, { turns: 1 })
  const text = await session.run('receipt')
  expect(text).toMatch(/context used\s+n\/a\n/)
  expect(text).toMatch(/cost\s+n\/a\n/)
  expect(text).not.toContain('$')
  expect(text).not.toContain('NaN')
})

test('receipt: an empty session still prints a whole receipt', async ($, on) => {
  const session = probe($, on)
  const text = await session.run('receipt')
  expect(text).toMatch(/TOOL CALLS\s+0\n/)
  expect(text).toMatch(/session length\s+0s\n/)
})

test('receipt: no credential reaches the text or the clipboard', async ($, on) => {
  const session = probe($, on)
  await session.bash(`echo ${FAKE.github}`)
  const text = await session.run('receipt')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
})

test('receipt: last line is the signature, no em-dashes, one width', async ($, on) => {
  const session = probe($, on, { turns: 3, now: 5 * MINUTE, percent: 9, usd: 0.5 })
  await busySession(session)
  await session.run('receipt')
  const receipt = session.copied()[0] ?? ''
  expect(receipt.split('\n').at(-1)).toBe(LAST_LINE)
  expect(receipt).not.toContain('—')
  const widths = new Set(receipt.split('\n').map(line => line.length))
  expect(widths.size).toBe(1)
})

test('receipt: the clipboard gets the receipt and the output says it worked', async ($, on) => {
  const session = probe($, on, { turns: 2 })
  await session.bash('ls')
  const text = await session.run('receipt')
  expect(session.copied().length).toBe(1)
  expect(text.startsWith(session.copied()[0] ?? 'missing')).toBe(true)
  expect(text).toMatch(/copied to clipboard/)
})

test('receipt: a refused clipboard is reported, not hidden', async ($, on) => {
  const session = probe($, on, { copy: 'no-clipboard' })
  const text = await session.run('receipt')
  expect(text).toMatch(/not copied \(no-clipboard\)/)
  expect(text).toContain(LAST_LINE)
})

test('receipt: a clipboard that throws still prints the receipt', async ($, on) => {
  const session = probe($, on, { copy: 'throw' })
  const text = await session.run('receipt')
  expect(text).toMatch(/not copied/)
  expect(text).toContain(LAST_LINE)
})

test('receipt: the output row draws a box on every surface', async ($, on) => {
  const session = probe($, on, { turns: 2 })
  await session.bash('ls')
  const text = await session.run('receipt')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'receipt', surface, component: 'CommandOutput', props: { command: 'receipt', args: '', text, isErrored: false } })
    expect(await ui.find({ type: 'Text', text: /SESSION RECEIPT/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /made with Claude Code/ })).toBeDefined()
    await ui.unmount()
  }
})
