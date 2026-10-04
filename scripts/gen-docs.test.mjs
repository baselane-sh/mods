// Tests for scripts/gen-docs.mjs: grouping, commands, notes and idempotence.
//
//   node --test scripts/
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { END, START, commandsIn, describeMods, groupByFamily, readCatalogs, renderCatalog, rootOf, splice } from './gen-docs.mjs'

const catalogs = [
  {
    engine: 'stats',
    mods: [
      { name: 'wrapped', description: 'Adds /wrapped: a recap (or /wrapped month).', rules: ['wrapped'] },
      { name: 'streaks', description: 'A streak toast, and /streak to ask.', rules: ['streaks'] },
      { name: 'stats-pack', description: 'Every stats mod: /wrapped and streaks.', rules: ['wrapped', 'streaks'] },
    ],
  },
  {
    engine: 'guard',
    mods: [
      { name: 'guard-pack', description: 'Every guard.', rules: ['a', 'b'] },
      { name: 'curl-pipe-guard', description: 'Asks before curl | sh.', rules: ['a'] },
    ],
  },
  {
    engine: 'nudge',
    mods: [{ name: 'ctx-nudge', description: 'Reminds you to /clear or /compact past 75 percent.', rules: ['ctx'] }],
  },
  {
    engine: 'firewall',
    mods: [{ name: 'agent-firewall', description: 'A live pane. Open it with /firewall.', rules: ['summarize'] }],
  },
  {
    engine: 'pane',
    mods: [{ name: 'git-pane', description: 'A live pane of path/to/file.ts and TODO/FIXME. Open it with /git.', rules: ['git-pane'] }],
  },
]

const userConfig = { streaks: { tz: { type: 'string' } } }
const mods = describeMods(catalogs, name => userConfig[name] ?? {})
const byName = name => mods.find(mod => mod.name === name)

test('commandsIn skips built-in commands, paths and slash lists', () => {
  assert.deepEqual(commandsIn('Reminds you to /clear or /compact.'), [])
  assert.deepEqual(commandsIn('Links path/to/file.ts:42 and TODO/FIXME, a 25/5 timer.'), [])
  assert.deepEqual(commandsIn('Adds /receipt (and /standup).'), ['receipt', 'standup'])
})

test('a pack lists the commands of all its rules, once each', () => {
  assert.deepEqual(byName('stats-pack').commands, ['wrapped', 'streak'])
  assert.deepEqual(byName('wrapped').commands, ['wrapped'])
  assert.deepEqual(byName('ctx-nudge').commands, [])
})

test('needs setup follows userConfig and pack follows the rule count', () => {
  assert.equal(byName('streaks').needsSetup, true)
  assert.equal(byName('wrapped').needsSetup, false)
  assert.equal(byName('stats-pack').pack, true)
  assert.equal(byName('curl-pipe-guard').pack, false)
})

test('groups follow the family order, merge engines and put packs last', () => {
  const groups = groupByFamily(mods)
  assert.deepEqual(
    groups.map(group => group.title),
    ['Guards', 'Reminders', 'Panes', 'Stats'],
  )
  assert.deepEqual(groups[0].mods.map(mod => mod.name), ['curl-pipe-guard', 'guard-pack'])
  assert.deepEqual(groups[2].mods.map(mod => mod.name), ['agent-firewall', 'git-pane'])
})

test('an engine with no family stops the run', () => {
  const stray = describeMods([{ engine: 'mystery', mods: [{ name: 'x', description: 'x', rules: ['x'] }] }], () => ({}))
  assert.throws(() => groupByFamily(stray), /mystery/)
})

test('the table escapes pipes and states the total', () => {
  const text = renderCatalog(groupByFamily(mods))
  assert.match(text, /\*\*8 mods\*\* in 4 families/)
  assert.match(text, /curl \\\| sh/)
  assert.match(text, /\| `streaks` \| .* \| `\/streak` \| needs setup \|/)
})

test('splice keeps the text outside the markers and is idempotent', () => {
  const readme = `# Title\n\nIntro.\n\n${START}\nold table\n${END}\n\nFooter.\n`
  const generated = renderCatalog(groupByFamily(mods))
  const once = splice(readme, generated)
  const twice = splice(once, generated)
  assert.equal(twice, once)
  assert.ok(once.startsWith('# Title\n\nIntro.\n\n'))
  assert.ok(once.endsWith(`${END}\n\nFooter.\n`))
  assert.ok(!once.includes('old table'))
})

test('splice refuses a text with no markers', () => {
  assert.throws(() => splice('# no markers\n', 'x'), /catalog:start/)
})

test('rootOf decodes a checkout path with a space', () => {
  assert.equal(rootOf('file:///Users/me/My%20Mods/mods/scripts/gen-docs.mjs'), '/Users/me/My Mods/mods/')
})

// The catalog table reads best with short descriptions. Only the nudge
// catalogs are held to this here; other engines are trimmed on their own.
test('nudge catalog descriptions are 200 characters or fewer', () => {
  const long = readCatalogs(rootOf(import.meta.url))
    .filter(catalog => catalog.engine === 'nudge')
    .flatMap(catalog => catalog.mods)
    .filter(mod => mod.description.length > 200)
    .map(mod => `${mod.name} (${mod.description.length})`)
  assert.deepEqual(long, [])
})
