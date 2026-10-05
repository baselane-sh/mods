// Tests for scripts/calls-report.mjs: the line it prints for one mod.
//
//   node --test scripts/
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { lineFor } from './calls-report.mjs'

const validate = lines => ['Validating hooks: x/hooks/hooks.json', '', ...lines.map(line => `  ❯ ${line}`), '', '✔ Validation passed'].join('\n')

test('hooks and calls, with no env or state, keep the short line', () => {
  const output = validate([
    './register.ts hooks: classic.Stop',
    './register.ts calls: $.ui.toast, $.clock.now (via helper)',
    './register.ts env writes: nothing',
  ])
  assert.equal(lineFor('m', output), 'm | hooks: classic.Stop | calls: $.clock.now, $.ui.toast')
})

test('env and state reads and writes are listed when the mod has them', () => {
  const output = validate([
    'types ./types/index.d.ts declares state: m.a, m.b',
    './register.ts hooks: session.end',
    './register.ts calls: $.env.get, $.state.set',
    './register.ts env writes: nothing',
    './register.ts env reads: HOME',
    './register.ts state writes: m.a',
    './register.ts state reads: m.b, m.a',
  ])
  assert.equal(
    lineFor('m', output),
    'm | hooks: session.end | calls: $.env.get, $.state.set | env reads: HOME | state reads: m.a, m.b | state writes: m.a',
  )
})
