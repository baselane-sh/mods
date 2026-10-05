import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'ci-band')
  await ui.unmount()
  return found
}

const RUN = (status: string, conclusion: string) => ({ stdout: JSON.stringify([{ status, conclusion }]) })

test('ci-band: the latest run of the branch, after the first Bash call', async ($, on) => {
  const session = probe($, on)
  session.setCommand('gh', RUN('completed', 'success'))
  await session.turn({})
  // The branch is not known before the first git read.
  expect(await read(session)).toBeUndefined()
  expect(session.calls('gh')).toEqual([])
  await session.bash('ls')
  await session.advance(60_000)
  for (const surface of SURFACES) expect((await read(session, surface))?.text).toBe('ci passed')
  expect(session.calls('gh')).toEqual([['gh', 'run', 'list', '--branch', 'main', '--limit', '1', '--json', 'status,conclusion']])
})

test('ci-band: passed is green, failed is red, running is yellow', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  const seen: [string, string | undefined][] = []
  for (const [reply, expected] of [
    [RUN('completed', 'success'), 'green'],
    [RUN('completed', 'failure'), 'red'],
    [RUN('in_progress', ''), 'yellow'],
    [RUN('queued', ''), 'yellow'],
    [RUN('completed', 'timed_out'), 'red'],
  ] as const) {
    session.setCommand('gh', reply)
    await session.turn({})
    await session.advance(120_000)
    const found = await read(session)
    seen.push([found?.text ?? '', found?.color as string | undefined])
    expect(found?.color).toBe(expected)
  }
  expect(seen.map(([text]) => text)).toEqual(['ci passed', 'ci failed', 'ci running', 'ci running', 'ci failed'])
})

test('ci-band: other conclusions are named plainly', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  session.setCommand('gh', RUN('completed', 'cancelled'))
  await session.turn({})
  expect((await read(session))?.text).toBe('ci cancelled')
  session.setCommand('gh', RUN('completed', 'action_required'))
  await session.advance(120_000)
  expect((await read(session))?.text).toBe('ci failed')
})

test('ci-band: no run, bad output, or a failed gh shows nothing', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  session.setCommand('gh', { stdout: '[]' })
  await session.turn({})
  expect(await read(session)).toBeUndefined()
  for (const stdout of ['not json', '{"status":"completed"}', '[null]', '[{"status":3}]', '[{"status":"completed","conclusion":""}]']) {
    session.setCommand('gh', { stdout })
    await session.advance(120_000)
    expect(await read(session)).toBeUndefined()
  }
  session.setCommand('gh', RUN('completed', 'success'))
  await session.advance(120_000)
  expect((await read(session))?.text).toBe('ci passed')
  session.setCommand('gh', { exitCode: 1, stdout: JSON.stringify([{ status: 'completed', conclusion: 'success' }]) })
  await session.advance(120_000)
  expect(await read(session)).toBeUndefined()
})

test('ci-band: without gh installed it shows nothing and says so once', async ($, on) => {
  const session = probe($, on)
  session.setCommand('gh', RUN('completed', 'success'))
  await session.bash('ls')
  await session.turn({})
  expect((await read(session))?.text).toBe('ci passed')
  session.setCommand('gh', 'reject')
  await session.advance(120_000)
  await session.advance(120_000)
  expect(await read(session)).toBeUndefined()
  expect(session.logs().filter(line => line.includes('ci-band')).length).toBe(1)
})

test('ci-band: at most one gh call every two minutes, each with a timeout', async ($, on) => {
  const session = probe($, on)
  session.setCommand('gh', RUN('completed', 'success'))
  await session.bash('ls')
  await session.turn({})
  await session.turn({})
  await session.bash('ls')
  await session.advance(119_000)
  expect(session.calls('gh').length).toBe(1)
  await session.advance(1000)
  expect(session.calls('gh').length).toBe(2)
  await session.advance(60_000)
  expect(session.calls('gh').length).toBe(2)
  await session.advance(60_000)
  expect(session.calls('gh').length).toBe(3)
  expect(session.timeouts('gh')).toEqual([10_000, 10_000, 10_000])
})

test('ci-band: a figure for the old branch is not drawn on the new one', async ($, on) => {
  const session = probe($, on)
  session.setCommand('gh', RUN('completed', 'failure'))
  await session.bash('ls')
  await session.turn({})
  expect((await read(session))?.text).toBe('ci failed')
  session.setGit('## dev\n')
  await session.bash('git checkout dev')
  expect(await read(session)).toBeUndefined()
  session.setCommand('gh', RUN('completed', 'success'))
  await session.advance(120_000)
  expect((await read(session))?.text).toBe('ci passed')
  expect(session.calls('gh').map(argv => argv[4])).toEqual(['main', 'dev'])
})

test('ci-band: a detached head or a repository with no branch asks gh nothing', async ($, on) => {
  const session = probe($, on)
  session.setCommand('gh', RUN('completed', 'success'))
  session.setGit('## HEAD (no branch)\n')
  await session.bash('ls')
  await session.turn({})
  await session.advance(240_000)
  expect(session.calls('gh')).toEqual([])
  expect(await read(session)).toBeUndefined()
})

test('ci-band: the branch is one argv element, never a shell word', async ($, on) => {
  const session = probe($, on)
  session.setCommand('gh', RUN('completed', 'success'))
  session.setGit('## feat/$(touch x);y...origin/feat\n')
  await session.bash('ls')
  await session.turn({})
  expect(session.calls('gh')[0]?.[4]).toBe('feat/$(touch x);y')
})

test('ci-band: a slow gh never holds back a tool result', async ($, on) => {
  const session = probe($, on)
  session.setCommand('gh', { ...RUN('completed', 'success'), delayMs: 10_000 })
  await session.bash('ls')
  await session.turn({})
  expect(await session.bash('ls')).toEqual({ result: {} })
  expect(await read(session)).toBeUndefined()
  await session.advance(10_000)
  expect((await read(session))?.text).toBe('ci passed')
})
