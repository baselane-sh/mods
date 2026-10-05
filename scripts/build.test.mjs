// Tests for scripts/build.mjs: `needs` in engine.json must name real rules
// and needs some host gives. Each test copies build.mjs into a scratch root
// with a tiny fixture engine and runs it there.
//
//   node --test scripts/
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const BUILD = join(dirname(fileURLToPath(import.meta.url)), 'build.mjs')

const put = (root, file, text) => {
  mkdirSync(dirname(join(root, file)), { recursive: true })
  writeFileSync(join(root, file), text)
}

// One engine `x` with one rule `nudge` and one group `stop`: a host that
// gives nothing and a host that gives `env`.
const buildWith = needs => {
  const root = mkdtempSync(join(tmpdir(), 'build-test-'))
  mkdirSync(join(root, 'scripts'), { recursive: true })
  copyFileSync(BUILD, join(root, 'scripts/build.mjs'))
  put(root, 'LICENSE', 'MIT\n')
  put(root, 'catalog/x.json', JSON.stringify({ engine: 'x', mods: [{ name: 'x-mod', description: 'A test mod.', rules: ['nudge'] }] }))
  put(
    root,
    'engines/x/engine.json',
    JSON.stringify({
      tests: [],
      ruleExport: 'rule',
      needs,
      hosts: {
        stop: [
          { file: 'hooks/hosts/quiet.ts', export: 'quiet', gives: [] },
          { file: 'hooks/hosts/env.ts', export: 'withEnv', gives: ['env'] },
        ],
      },
    }),
  )
  put(root, 'engines/x/hooks/rules/nudge.ts', 'export const rule = {}\n')
  put(root, 'engines/x/hooks/hosts/quiet.ts', 'export const quiet = () => {}\n')
  put(root, 'engines/x/hooks/hosts/env.ts', 'export const withEnv = () => {}\n')
  put(root, 'engines/x/tests/nudge.test.ts', 'export {}\n')
  const run = spawnSync(process.execPath, [join(root, 'scripts/build.mjs')], { encoding: 'utf8' })
  const registerFile = join(root, 'plugins/x-mod/hooks/register.ts')
  const register = run.status === 0 ? readFileSync(registerFile, 'utf8') : ''
  rmSync(root, { recursive: true, force: true })
  return { status: run.status, stderr: run.stderr, register }
}

test('a need every host knows picks the host that gives it', () => {
  const { status, stderr, register } = buildWith({ nudge: ['env'] })
  assert.equal(status, 0, stderr)
  assert.match(register, /withEnv\(on, rules\)/)
})

test('a need no host gives fails the build', () => {
  const { status, stderr } = buildWith({ nudge: ['envv'] })
  assert.notEqual(status, 0)
  assert.match(stderr, /x: rule nudge needs "envv", but no host gives it/)
})

test('a needs key that names no rule fails the build', () => {
  const { status, stderr } = buildWith({ nudge: ['env'], nudgee: ['env'] })
  assert.notEqual(status, 0)
  assert.match(stderr, /x: needs names "nudgee", but there is no rule hooks\/rules\/nudgee\.ts/)
})
