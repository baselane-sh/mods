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

// Each engine describes itself in engines/<name>/engine.json:
//   hooks       shared files copied into every mod's hooks/
//   tests       shared test files copied into every mod's tests/
//   register    the function engine.ts exports, called with (on, rules)
//   ruleExport  "rule" (a module exports a value) or "create" (a factory,
//               called once per load, for rules that keep session state)
//   types       optional: a file under engines/<name>/types/, the state
//               contract (PluginState). Copied to each mod as
//               types/index.d.ts and named in its plugin.json as "types".
const loadEngine = name => {
  const config = JSON.parse(readFileSync(join(ROOT, 'engines', name, 'engine.json'), 'utf8'))
  const isFactory = config.ruleExport === 'create'
  return {
    ...config,
    importRule: id => `import { ${config.ruleExport} as ${camel(id)} } from './rules/${id}'`,
    useRule: id => (isFactory ? `${camel(id)}()` : camel(id)),
  }
}

const registerSource = (engine, rules) =>
  [
    "import type { Register } from 'claude-code'",
    '',
    `import { ${engine.register} } from './engine'`,
    ...rules.map(engine.importRule),
    '',
    `export const register: Register = on => ${engine.register}(on, [${rules.map(engine.useRule).join(', ')}])`,
    '',
  ].join('\n')

const buildMod = (engine, engineDir, mod, outDir) => {
  for (const id of mod.rules) {
    if (!existsSync(join(engineDir, 'hooks/rules', `${id}.ts`))) {
      throw new Error(`${mod.name}: no rule named ${id}`)
    }
  }

  rmSync(outDir, { recursive: true, force: true })
  write(join(outDir, MARKER), 'Built by scripts/build.mjs from catalog/. Edit the engine or the catalog, not this folder.\n')
  const contract = engine.types === undefined ? {} : { types: './types/index.d.ts' }
  write(
    join(outDir, '.claude-plugin/plugin.json'),
    `${JSON.stringify({ name: mod.name, version: VERSION, description: mod.description, author: AUTHOR, license: LICENSE, ...contract }, null, 2)}\n`,
  )
  if (engine.types !== undefined) {
    write(join(outDir, 'types/index.d.ts'), readFileSync(join(engineDir, 'types', engine.types), 'utf8'))
  }
  cpSync(join(ROOT, 'LICENSE'), join(outDir, 'LICENSE'))
  write(join(outDir, 'hooks/hooks.json'), '{ "modules": ["./register.ts"] }\n')
  write(join(outDir, 'hooks/register.ts'), registerSource(engine, mod.rules))

  for (const file of engine.hooks) {
    cpSync(join(engineDir, 'hooks', file), join(outDir, 'hooks', file))
  }
  for (const file of engine.tests) {
    cpSync(join(engineDir, 'tests', file), join(outDir, 'tests', file))
  }
  for (const id of mod.rules) {
    cpSync(join(engineDir, 'hooks/rules', `${id}.ts`), join(outDir, 'hooks/rules', `${id}.ts`))
    cpSync(join(engineDir, 'tests', `${id}.test.ts`), join(outDir, 'tests', `${id}.test.ts`))
  }
}

const catalogs = readdirSync(join(ROOT, 'catalog'))
  .filter(file => file.endsWith('.json'))
  .map(file => JSON.parse(readFileSync(join(ROOT, 'catalog', file), 'utf8')))

const mods = catalogs.flatMap(catalog => {
  if (!existsSync(join(ROOT, 'engines', catalog.engine, 'engine.json'))) {
    throw new Error(`unknown engine ${catalog.engine}`)
  }
  const engine = loadEngine(catalog.engine)
  return catalog.mods.map(mod => {
    buildMod(engine, join(ROOT, 'engines', catalog.engine), mod, join(ROOT, 'plugins', mod.name))
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
