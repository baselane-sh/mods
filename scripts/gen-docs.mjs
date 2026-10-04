// Writes the generated catalog in README.md, between the catalog markers,
// from catalog/*.json and each mod's built plugin.json (for userConfig).
// It touches only the text between the markers, and a rerun with the same
// catalog gives the same file.
//
//   node scripts/build.mjs && node scripts/gen-docs.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = new URL('..', import.meta.url).pathname

export const START = '<!-- catalog:start -->'
export const END = '<!-- catalog:end -->'

// Families in display order, and the engines whose mods belong to each.
// A catalog that names an engine not listed here stops the run, so a new
// engine gets a family on purpose and never falls into a catch-all.
export const FAMILIES = [
  { title: 'Guards', engines: ['guard'], blurb: 'Ask you before a harsh or risky command runs.' },
  { title: 'Reminders', engines: ['nudge'], blurb: 'One quiet toast at turn end when something needs your attention.' },
  { title: 'Commands', engines: ['command'], blurb: 'Slash commands that print a result and, where it helps, copy it.' },
  { title: 'Band meters', engines: ['band'], blurb: 'A one-line band above the prompt.' },
  { title: 'Panes', engines: ['pane', 'firewall'], blurb: 'Live side panes that you open with a slash command.' },
  { title: 'Prompt styles', engines: ['style'], blurb: 'Change how Claude writes. Code and commands stay exact.' },
  { title: 'Sounds', engines: ['sound'], blurb: 'Short sounds for passing tests, failing tests, blocked calls and turn ends.' },
  { title: 'Stats', engines: ['stats'], blurb: 'Local records of how you use Claude Code.' },
  { title: 'Display and render', engines: ['render'], blurb: 'Change how rows and replies look on your screen. What Claude reads does not change.' },
  { title: 'Lifecycle and notify', engines: ['lifecycle'], blurb: 'Act on session events: format files, push a notification, keep a journal.' },
]

// Claude Code's own commands. A description may tell you to run one (for
// example "/clear or /compact"), and that does not make it the mod's command.
const BUILT_IN_COMMANDS = new Set([
  'add-dir', 'agents', 'bug', 'clear', 'compact', 'config', 'context', 'cost', 'doctor', 'exit', 'help',
  'hooks', 'init', 'login', 'logout', 'mcp', 'memory', 'model', 'permissions', 'plugin', 'resume',
  'review', 'status', 'terminal-setup', 'vim',
])

// A slash command starts a word: at the start, after a space or after "(".
// This skips paths such as path/to/file.ts and lists such as TODO/FIXME.
const COMMAND_TOKEN = /(?:^|[\s(])\/([a-z][a-z0-9-]*)/g

export const commandsIn = description =>
  [...description.matchAll(COMMAND_TOKEN)].map(match => match[1]).filter(name => !BUILT_IN_COMMANDS.has(name))

const unique = list => [...new Set(list)]

export const readCatalogs = root =>
  readdirSync(join(root, 'catalog'))
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => JSON.parse(readFileSync(join(root, 'catalog', file), 'utf8')))

// The userConfig a mod ships with, read from its built plugin.json.
export const readUserConfig = (root, name) => {
  const path = join(root, 'plugins', name, '.claude-plugin', 'plugin.json')
  if (!existsSync(path)) throw new Error(`${name}: no ${path}. Run node scripts/build.mjs first.`)
  return JSON.parse(readFileSync(path, 'utf8')).userConfig ?? {}
}

// Flat list of mods with what the table shows. A pack's description may not
// name every command its rules add, so a mod's commands are the ones its own
// description names plus the ones each of its rules adds in its single mod.
export const describeMods = (catalogs, userConfigOf) => {
  const raw = catalogs.flatMap(catalog => catalog.mods.map(mod => ({ ...mod, engine: catalog.engine })))
  const ruleCommands = new Map(
    raw.filter(mod => mod.rules.length === 1).map(mod => [`${mod.engine}:${mod.rules[0]}`, commandsIn(mod.description)]),
  )
  return raw.map(mod => ({
    name: mod.name,
    description: mod.description,
    engine: mod.engine,
    commands: unique([
      ...commandsIn(mod.description),
      ...mod.rules.flatMap(id => ruleCommands.get(`${mod.engine}:${id}`) ?? []),
    ]),
    needsSetup: Object.keys(userConfigOf(mod.name)).length > 0,
    pack: mod.rules.length > 1,
  }))
}

// Families in FAMILIES order, empty ones left out. Inside a family, single
// mods come first and packs last, each in catalog order.
export const groupByFamily = mods => {
  for (const mod of mods) {
    if (!FAMILIES.some(family => family.engines.includes(mod.engine))) {
      throw new Error(`${mod.name}: engine "${mod.engine}" has no family in scripts/gen-docs.mjs`)
    }
  }
  return FAMILIES.map(family => {
    const members = mods.filter(mod => family.engines.includes(mod.engine))
    return { ...family, mods: [...members.filter(mod => !mod.pack), ...members.filter(mod => mod.pack)] }
  }).filter(family => family.mods.length > 0)
}

const cell = text => text.replaceAll('|', '\\|').replaceAll('\n', ' ')

const row = mod => {
  const commands = mod.commands.map(name => `\`/${name}\``).join(', ')
  const notes = [mod.needsSetup ? 'needs setup' : '', mod.pack ? 'pack' : ''].filter(Boolean).join(', ')
  return `| \`${mod.name}\` | ${cell(mod.description)} | ${commands} | ${notes} |`
}

export const renderCatalog = groups => {
  const total = groups.reduce((sum, group) => sum + group.mods.length, 0)
  const sections = groups.map(group =>
    [
      `### ${group.title} (${group.mods.length})`,
      '',
      group.blurb,
      '',
      '| Mod | What it does | Command | Notes |',
      '| --- | --- | --- | --- |',
      ...group.mods.map(row),
    ].join('\n'),
  )
  return [
    `**${total} mods** in ${groups.length} families.`,
    '',
    '"needs setup" means the mod has options that you set with `claude plugin configure <mod>`. ' +
      'Its description tells you if it works before you set them. "pack" means one mod with several rules.',
    '',
    ...sections.flatMap(section => [section, '']),
  ].join('\n')
}

// Puts `generated` between the markers and keeps the rest of the text.
export const splice = (text, generated) => {
  const start = text.indexOf(START)
  const end = text.indexOf(END)
  if (start === -1 || end === -1 || end < start) throw new Error(`README.md needs ${START} and then ${END}`)
  return `${text.slice(0, start + START.length)}\n\n${generated.trimEnd()}\n\n${text.slice(end)}`
}

const main = () => {
  const mods = describeMods(readCatalogs(ROOT), name => readUserConfig(ROOT, name))
  const groups = groupByFamily(mods)
  const path = join(ROOT, 'README.md')
  const before = readFileSync(path, 'utf8')
  const after = splice(before, renderCatalog(groups))
  if (after !== before) writeFileSync(path, after)
  process.stdout.write(`gen-docs: ${mods.length} mods in ${groups.length} families${after === before ? ', no change' : ''}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
