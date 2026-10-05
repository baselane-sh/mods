import { expect, test } from 'claude-code/testing'

import { IN_REPO } from './fixtures'
import { probe } from './probe'

test('audit-pack: registers /secret-scan, /conflicts and /licenses', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(
    session
      .registered()
      .map(c => c.name)
      .sort(),
  ).toEqual(['conflicts', 'licenses', 'secret-scan'])
})

test('audit-pack: each command answers on a clean repo', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, 'rev-parse --show-toplevel': '/repo\n' } })
  expect(await session.run('conflicts')).toBe('No conflict markers in tracked files.')
  expect(await session.run('secret-scan')).toBe('No secret-shaped text found in tracked files.')
  expect(await session.run('licenses')).toMatch(/^No direct dependencies/)
})
