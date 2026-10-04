import { expect, test } from 'claude-code/testing'

import { isCiConfig } from '../hooks/rules/ci-config'
import { probe } from './probe'

const CI = [
  '/repo/.github/workflows/ci.yml',
  '.github/workflows/release.yaml',
  './.github/workflows/deploy.yml',
  '/repo/.gitlab-ci.yml',
  '.gitlab-ci.yml',
  '/repo/.circleci/config.yml',
  'C:\\repo\\.github\\workflows\\ci.yml',
]
const NOT_CI = [
  '/repo/.github/dependabot.yml',
  '/repo/.github/CODEOWNERS',
  '/repo/.github/workflows',
  '/repo/docs/workflows/ci.yml',
  '/repo/github/workflows/ci.yml',
  '/repo/.circleci/README.md',
  '/repo/config.yml',
  '/repo/.gitlab-ci.yml.bak',
  '/repo/src/app.ts',
]

test('ci-config-guard: path table', () => {
  for (const path of CI) expect({ path, ci: isCiConfig(path) }).toEqual({ path, ci: true })
  for (const path of NOT_CI) expect({ path, ci: isCiConfig(path) }).toEqual({ path, ci: false })
})

test('ci-config-guard: asks for Write and Edit on CI config and passes the rest', async ($, on) => {
  const guard = probe($, on)
  for (const file_path of CI) {
    expect({ file_path, answered: await guard.answeredTool({ tool: 'Write', file_path, content: 'on: push' }) }).toEqual({ file_path, answered: true })
    expect({ file_path, answered: await guard.answeredTool({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) }).toEqual({ file_path, answered: true })
  }
  for (const file_path of NOT_CI) {
    expect({ file_path, answered: await guard.answeredTool({ tool: 'Write', file_path, content: 'x' }) }).toEqual({ file_path, answered: false })
  }
})

test('ci-config-guard: reads and shell commands pass', async ($, on) => {
  const guard = probe($, on)
  expect(await guard.answeredTool({ tool: 'Read', file_path: '/repo/.github/workflows/ci.yml' })).toBe(false)
  expect(await guard.answered('cat .github/workflows/ci.yml')).toBe(false)
})
