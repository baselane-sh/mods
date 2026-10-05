import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

// pgrep finds the player: a process id, exit 0.
const RUNNING = { stdout: '123\n' }

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'now-playing')
  await ui.unmount()
  return found?.text
}

test('now-playing: the track Music plays', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', RUNNING)
  session.setCommand('osascript', { stdout: 'Kind of Blue - Miles Davis\n' })
  await session.turn({})
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('♪ Kind of Blue - Miles Davis')
})

test('now-playing: it asks Music first and Spotify when Music plays nothing', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', RUNNING)
  session.setCommand('osascript', { stdout: '' })
  await session.turn({})
  expect(session.calls('osascript').length).toBe(2)
  expect(await read(session)).toBeUndefined()
})

test('now-playing: a Spotify track shows when Music is silent', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', RUNNING)
  session.setCommand('osascript', argv => ({ stdout: argv.join(' ').includes('"Spotify"') ? 'Hey Jude - Beatles\n' : '' }))
  await session.turn({})
  expect(await read(session)).toBe('♪ Hey Jude - Beatles')
  expect(session.calls('osascript').length).toBe(2)
})

test('now-playing: Music wins when both play, and Spotify is not asked', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', RUNNING)
  session.setCommand('osascript', argv => ({ stdout: argv.join(' ').includes('"Spotify"') ? 'Spot - S\n' : 'Mus - M\n' }))
  await session.turn({})
  expect(await read(session)).toBe('♪ Mus - M')
  expect(session.calls('osascript').length).toBe(1)
})

test('now-playing: the script is fixed argv, with no text of the session in it', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', RUNNING)
  session.setCommand('osascript', { stdout: '' })
  await session.bash('echo "$(whoami)"; rm -rf /')
  await session.turn({ model: 'claude-x', usd: 1 })
  const calls = session.calls('osascript')
  expect(calls.length).toBe(2)
  for (const argv of calls) {
    expect(argv[0]).toBe('osascript')
    // Every other element after the program is the -e flag, then one script line.
    expect(argv.slice(1).filter((_, at) => at % 2 === 0).every(flag => flag === '-e')).toBe(true)
    expect(argv.join(' ')).not.toContain('rm -rf')
    expect(argv.join(' ')).not.toContain('claude-x')
  }
  const [music, spotify] = calls
  expect(music?.join(' ')).toContain('application "Music" is running')
  expect(spotify?.join(' ')).toContain('application "Spotify" is running')
  expect(session.calls('pgrep')).toEqual([
    ['pgrep', '-x', 'Music'],
    ['pgrep', '-x', 'Spotify'],
  ])
})

test('now-playing: a player that is not running is never named to osascript', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', { exitCode: 1 })
  session.setCommand('osascript', { stdout: 'Song - Artist\n' })
  await session.turn({})
  expect(session.calls('pgrep').length).toBe(2)
  expect(session.calls('osascript').length).toBe(0)
  expect(await read(session)).toBeUndefined()
})

test('now-playing: with Music running and Spotify absent, only Music is asked', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', argv => (argv.includes('Music') ? RUNNING : { exitCode: 1 }))
  session.setCommand('osascript', { stdout: '' })
  await session.turn({})
  const calls = session.calls('osascript')
  expect(calls.length).toBe(1)
  expect(calls[0]?.join(' ')).not.toContain('Spotify')
})

test('now-playing: a pgrep that cannot start asks no player', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', 'reject')
  session.setCommand('osascript', { stdout: 'Song - Artist\n' })
  await session.turn({})
  expect(session.calls('osascript').length).toBe(0)
  expect(await read(session)).toBeUndefined()
})

test('now-playing: a long track is cut with an ellipsis, a second line is dropped', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', RUNNING)
  session.setCommand('osascript', { stdout: `${'A'.repeat(60)}\nsecond line\n` })
  await session.turn({})
  expect(await read(session)).toBe(`♪ ${'A'.repeat(39)}…`)
})

test('now-playing: a failed or missing osascript shows nothing', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', RUNNING)
  session.setCommand('osascript', { stdout: 'Song - Artist\n' })
  await session.turn({})
  expect(await read(session)).toBe('♪ Song - Artist')
  session.setCommand('osascript', { exitCode: 1, stdout: 'Song - Artist\n' })
  await session.advance(60_000)
  expect(await read(session)).toBeUndefined()
  session.setCommand('osascript', { stdout: 'Song - Artist\n' })
  await session.advance(60_000)
  session.setCommand('osascript', 'reject')
  await session.advance(60_000)
  expect(await read(session)).toBeUndefined()
})

test('now-playing: the track changes and then stops', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', RUNNING)
  session.setCommand('osascript', { stdout: 'One - A\n' })
  await session.turn({})
  session.setCommand('osascript', { stdout: 'Two - B\n' })
  await session.advance(60_000)
  expect(await read(session)).toBe('♪ Two - B')
  session.setCommand('osascript', { stdout: '\n' })
  await session.advance(60_000)
  expect(await read(session)).toBeUndefined()
})

test('now-playing: at most one round of asks a minute, each with a timeout', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', RUNNING)
  session.setCommand('osascript', { stdout: 'One - A\n' })
  await session.start()
  await session.settle()
  await session.advance(30_000)
  await session.turn({})
  await session.bash('ls')
  expect(session.calls('osascript').length).toBe(1)
  await session.advance(29_000)
  expect(session.calls('osascript').length).toBe(1)
  await session.advance(1000)
  expect(session.calls('osascript').length).toBe(2)
  expect(session.timeouts('osascript')).toEqual([5000, 5000])
})

test('now-playing: a slow osascript never holds back a tool result', async ($, on) => {
  const session = probe($, on)
  session.setCommand('pgrep', RUNNING)
  session.setCommand('osascript', { stdout: 'One - A\n', delayMs: 5000 })
  await session.turn({})
  expect(await session.bash('ls')).toEqual({ result: {} })
  expect(await read(session)).toBeUndefined()
  await session.advance(5000)
  expect(await read(session)).toBe('♪ One - A')
})
