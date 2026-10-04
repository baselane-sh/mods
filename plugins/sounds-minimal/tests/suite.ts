import { expect, test } from 'claude-code/testing'

import type { SoundRule } from '../hooks/engine'
import { probe } from './probe'

const assets = (id: string) => ({
  testPass: `assets/${id}/pass.wav`,
  testFail: `assets/${id}/fail.wav`,
  denied: `assets/${id}/deny.wav`,
  turnDone: `assets/${id}/done.wav`,
})

const played = (session: ReturnType<typeof probe>) => session.plays().map(play => play.asset)

// The behaviour every sound pack shares: the same events, the same options.
export const packSuite = (rule: SoundRule) => {
  const name = rule.id
  const clips = assets(name)

  test(`${name}: the pack names its four files`, () => {
    expect(rule.clips).toEqual(clips)
  })

  test(`${name}: a passing test run plays the pass sound`, async ($, on) => {
    const session = probe($, on)
    await session.bash('npm test')
    expect(played(session)).toEqual([clips.testPass])
  })

  test(`${name}: a failing test run plays the fail sound`, async ($, on) => {
    const session = probe($, on)
    await session.bash('cd app && pytest -q', 'error')
    expect(played(session)).toEqual([clips.testFail])
  })

  test(`${name}: a blocked call plays the deny sound`, async ($, on) => {
    const session = probe($, on)
    const ran = await session.bash('rm -rf /', 'deny')
    expect(ran.deny).toBe('blocked by a rule')
    expect(played(session)).toEqual([clips.denied])
  })

  test(`${name}: a blocked test run is a deny, not a pass`, async ($, on) => {
    const session = probe($, on)
    await session.bash('npm test', 'deny')
    expect(played(session)).toEqual([clips.denied])
  })

  test(`${name}: other commands stay silent, passing or failing`, async ($, on) => {
    const session = probe($, on)
    await session.bash('ls')
    await session.bash('grep vitest package.json', 'error')
    await session.bash('cat jest.config.js')
    expect(played(session)).toEqual([])
  })

  test(`${name}: a finished turn plays the done sound`, async ($, on) => {
    const session = probe($, on)
    await session.turn()
    expect(played(session)).toEqual([clips.turnDone])
  })

  test(`${name}: a subagent turn is ignored`, async ($, on) => {
    const session = probe($, on)
    await session.turn({ agentId: 'agent-1' })
    expect(played(session)).toEqual([])
  })

  test(`${name}: quiet turns off the done sound only`, { options: { quiet: true } }, async ($, on) => {
    const session = probe($, on)
    await session.turn()
    expect(played(session)).toEqual([])
    await session.bash('npm test')
    await session.bash('rm -rf /', 'deny')
    expect(played(session)).toEqual([clips.testPass, clips.denied])
  })

  test(`${name}: volume is the playback gain`, { options: { volume: 0.5 } }, async ($, on) => {
    const session = probe($, on)
    await session.bash('npm test')
    expect(session.plays().map(play => play.gain)).toEqual([0.5])
  })

  test(`${name}: volume 0 plays nothing`, { options: { volume: 0 } }, async ($, on) => {
    const session = probe($, on)
    await session.bash('npm test')
    await session.turn()
    expect(played(session)).toEqual([])
  })

  test(`${name}: a clip that cannot play never breaks the tool call`, async ($, on) => {
    const session = probe($, on, true)
    const ran = await session.bash('npm test')
    expect(ran.result).toEqual({ stdout: 'ok', stderr: '', interrupted: false })
    const failed = await session.bash('npm test', 'error')
    expect(failed.isError).toBe(true)
    const denied = await session.bash('rm -rf /', 'deny')
    expect(denied.deny).toBe('blocked by a rule')
    expect(session.logs().length).toBeGreaterThan(0)
  })

  test(`${name}: a clip that cannot play never breaks the turn`, async ($, on) => {
    const session = probe($, on, true)
    await session.turn()
    expect(session.logs().length).toBeGreaterThan(0)
  })
}
