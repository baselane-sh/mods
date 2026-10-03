import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

const IN_REPO = { 'rev-parse --is-inside-work-tree': 'true\n' }

test('gitignore-check: asks when an untracked secret file is not ignored', async ($, on) => {
  const guard = probe($, on, { git: { ...IN_REPO, 'ls-files --others --exclude-standard': '.env\nsrc/new.ts\n', 'ls-files': 'src/app.ts\n' } })
  expect(await guard.answered('git add .')).toBe(true)
})

test('gitignore-check: asks when a secret file is already tracked', async ($, on) => {
  const guard = probe($, on, { git: { ...IN_REPO, 'ls-files --others --exclude-standard': '', 'ls-files': 'config/secrets.yaml\n' } })
  expect(await guard.answered('git commit -m x')).toBe(true)
})

test('gitignore-check: passes a clean repo and public templates', async ($, on) => {
  const guard = probe($, on, { git: { ...IN_REPO, 'ls-files --others --exclude-standard': '.env.example\n', 'ls-files': 'src/app.ts\n' } })
  expect(await guard.answered('git add src')).toBe(false)
})

test('gitignore-check: a file list cut at the output cap asks', async ($, on) => {
  const guard = probe($, on, {
    git: { ...IN_REPO, 'ls-files --others --exclude-standard': '', 'ls-files': 'src/app.ts\n' },
    truncated: ['ls-files'],
  })
  expect(await guard.answered('git add .')).toBe(true)
})
