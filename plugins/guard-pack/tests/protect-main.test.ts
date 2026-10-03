import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

const IN_REPO = { 'rev-parse --is-inside-work-tree': 'true\n' }

test('protect-main: asks before commit, push or merge on main', async ($, on) => {
  const guard = probe($, on, { git: { ...IN_REPO, 'branch --show-current': 'main\n' } })
  for (const command of ['git commit -m x', 'git push origin main', 'git merge feat/x']) {
    expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  }
})

test('protect-main: passes on a feature branch', async ($, on) => {
  const guard = probe($, on, { git: { ...IN_REPO, 'branch --show-current': 'feat/x\n' } })
  expect(await guard.answered('git commit -m x')).toBe(false)
})

test('protect-main: passes git reads on main', async ($, on) => {
  const guard = probe($, on, { git: { ...IN_REPO, 'branch --show-current': 'master\n' } })
  expect(await guard.answered('git status')).toBe(false)
})

test('protect-main: a branch read cut at the output cap asks', async ($, on) => {
  const guard = probe($, on, { git: { ...IN_REPO, 'branch --show-current': 'feat/x\n' }, truncated: ['branch --show-current'] })
  expect(await guard.answered('git commit -m x')).toBe(true)
})

test('protect-main: follows git -C into another repo', async ($, on) => {
  const guard = probe($, on, {
    git: {
      'git -C /repo/sub rev-parse --is-inside-work-tree': 'true\n',
      'git -C /repo/sub branch --show-current': 'main\n',
    },
  })
  expect(await guard.answered('git -C sub commit -m x')).toBe(true)
})
