// Builds one standalone plugin folder per catalog entry under plugins/, and
// the marketplace file that lists them. A plugin may import only its own
// files, so each one gets its own copy of the engine and the rules it uses.
//
//   node scripts/build.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const AUTHOR = { name: 'Baselane', url: 'https://baselane.sh' }
const MARKER = '.generated'
const VERSION = '0.1.0'
const LICENSE = 'MIT'

const camel = id => id.replace(/-(\w)/g, (_, c) => c.toUpperCase())

const write = (path, text) => {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, text)
}

const registerSource = rules =>
  [
    "import type { Register } from 'claude-code'",
    '',
    "import { registerGuards } from './engine'",
    ...rules.map(id => `import { rule as ${camel(id)} } from './rules/${id}'`),
    '',
    `export const register: Register = on => registerGuards(on, [${rules.map(camel).join(', ')}])`,
    '',
  ].join('\n')

const buildGuardMod = (engineDir, mod, outDir) => {
  for (const id of mod.rules) {
    if (!existsSync(join(engineDir, 'hooks/rules', `${id}.ts`))) {
      throw new Error(`${mod.name}: no rule named ${id}`)
    }
  }

  rmSync(outDir, { recursive: true, force: true })
  write(join(outDir, MARKER), 'Built by scripts/build.mjs from catalog/. Edit the engine or the catalog, not this folder.\n')
  write(
    join(outDir, '.claude-plugin/plugin.json'),
    `${JSON.stringify({ name: mod.name, version: VERSION, description: mod.description, author: AUTHOR, license: LICENSE }, null, 2)}\n`,
  )
  cpSync(join(ROOT, 'LICENSE'), join(outDir, 'LICENSE'))
  write(join(outDir, 'hooks/hooks.json'), '{ "modules": ["./register.ts"] }\n')
  write(join(outDir, 'hooks/register.ts'), registerSource(mod.rules))

  for (const file of ['engine.ts', 'patterns.ts']) {
    cpSync(join(engineDir, 'hooks', file), join(outDir, 'hooks', file))
  }
  for (const file of ['probe.ts', 'fixtures.ts', 'engine.test.ts']) {
    cpSync(join(engineDir, 'tests', file), join(outDir, 'tests', file))
  }
  for (const id of mod.rules) {
    cpSync(join(engineDir, 'hooks/rules', `${id}.ts`), join(outDir, 'hooks/rules', `${id}.ts`))
    cpSync(join(engineDir, 'tests', `${id}.test.ts`), join(outDir, 'tests', `${id}.test.ts`))
  }
}

const BUILDERS = { guard: buildGuardMod }

const catalogs = readdirSync(join(ROOT, 'catalog'))
  .filter(file => file.endsWith('.json'))
  .map(file => JSON.parse(readFileSync(join(ROOT, 'catalog', file), 'utf8')))

const mods = catalogs.flatMap(catalog => {
  const build = BUILDERS[catalog.engine]
  if (build === undefined) throw new Error(`unknown engine ${catalog.engine}`)
  return catalog.mods.map(mod => {
    build(join(ROOT, 'engines', catalog.engine), mod, join(ROOT, 'plugins', mod.name))
    return mod
  })
})

const names = new Set(mods.map(mod => mod.name))
if (names.size !== mods.length) throw new Error('two catalog entries share a name')

write(
  join(ROOT, '.claude-plugin/marketplace.json'),
  `${JSON.stringify(
    {
      name: 'baselane-mods',
      description: 'Baselane mods for Claude Code: guards, panes and tools you pick and combine.',
      owner: AUTHOR,
      plugins: mods.map(mod => ({
        name: mod.name,
        source: `./plugins/${mod.name}`,
        description: mod.description,
        version: VERSION,
        author: AUTHOR,
      })),
    },
    null,
    2,
  )}\n`,
)

process.stdout.write(`built ${mods.length} mods: ${mods.map(mod => mod.name).join(', ')}\n`)
