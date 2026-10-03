import { expect, test } from 'claude-code/testing'

import { repoDirFor } from '../hooks/git'
import { scanDiff } from '../hooks/rules/secret-commit'
import { FAKE } from './fixtures'
import { probe } from './probe'

const IN_REPO = { 'rev-parse --is-inside-work-tree': 'true\n' }
const LEAKY_DIFF = `diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -0,0 +1 @@\n+const key = "${FAKE.stripe}"\n`
const CLEAN_DIFF = 'diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -0,0 +1 @@\n+const key = process.env.KEY\n'

test('secret-commit-guard: asks when the staged diff adds a credential', async ($, on) => {
  const guard = probe($, on, {
    git: { ...IN_REPO, 'diff --cached --name-only --diff-filter=AMR': 'src/app.ts\n', 'diff --cached -U0 --diff-filter=AM': LEAKY_DIFF },
  })
  expect(await guard.answered('git commit -m "add client"')).toBe(true)
})

test('secret-commit-guard: asks when a secret-named file is staged', async ($, on) => {
  const guard = probe($, on, {
    git: { ...IN_REPO, 'diff --cached --name-only --diff-filter=AMR': '.env\n', 'diff --cached -U0 --diff-filter=AM': CLEAN_DIFF },
  })
  expect(await guard.answered('git -c user.name=x commit -m wip')).toBe(true)
})

test('secret-commit-guard: -a also scans unstaged changes', async ($, on) => {
  const guard = probe($, on, {
    git: { ...IN_REPO, 'diff HEAD --name-only --diff-filter=AMR': 'src/app.ts\n', 'diff HEAD -U0 --diff-filter=AM': LEAKY_DIFF },
  })
  expect(await guard.answered('git commit -am "wip"')).toBe(true)
})

test('secret-commit-guard: a clean commit and a non-repo pass', async ($, on) => {
  const clean = probe($, on, {
    git: { ...IN_REPO, 'diff --cached --name-only --diff-filter=AMR': 'src/app.ts\n', 'diff --cached -U0 --diff-filter=AM': CLEAN_DIFF },
  })
  expect(await clean.answered('git commit -m "clean"')).toBe(false)
})

test('secret-commit-guard: outside a repo passes', async ($, on) => {
  const guard = probe($, on, { git: {} })
  expect(await guard.answered('git commit -m x')).toBe(false)
})

test('secret-commit-guard: diff scan counts lines per file', () => {
  const diff = `${LEAKY_DIFF}+++ b/lib/db.ts\n+const url = "${FAKE.postgres}"\n+const ok = 1\n`
  expect(scanDiff(diff)).toEqual({ valueLines: 2, valueFiles: ['src/app.ts', 'lib/db.ts'] })
})

test('secret-commit-guard: follows git -C', () => {
  expect(repoDirFor('git -C sub commit -m x', '/repo')).toBe('/repo/sub')
  expect(repoDirFor('git -C "/abs path" commit', '/repo')).toBe('/abs path')
  expect(repoDirFor('git commit -m x', '/repo')).toBe('/repo')
})
