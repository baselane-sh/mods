// Builds one standalone plugin folder per catalog entry under plugins/, and
// the marketplace file that lists them. A plugin may import only its own
// files, so each one gets its own copy of the engine and the rules it uses.
//
//   node scripts/build.mjs
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
//   options     optional. true passes the plugin's userConfig values to
//               register as a third argument: register(on, rules, options)
//   userConfig  optional. { ruleId: { field: spec } }: the userConfig fields
//               each rule reads. A mod's plugin.json carries the fields of
//               its own rules only.
//   types       optional: a contract .d.ts (the plugin's `$.state` shape),
//               copied to the mod at the same path and named in plugin.json
//   nameToken   optional: a string that stands for the mod's own name. Every
//               file copied into the mod has each occurrence replaced by the
//               mod's name. `$.state` allows only the owning plugin to write
//               a value, and its `plugin` must be a literal in source, so an
//               engine whose mods share one source writes the token there.
const loadEngine = name => {
  const config = JSON.parse(readFileSync(join(ROOT, 'engines', name, 'engine.json'), 'utf8'))
  const isFactory = config.ruleExport === 'create'
  return {
    ...config,
    importRule: id => `import { ${config.ruleExport} as ${camel(id)} } from './rules/${id}'`,
    useRule: id => (isFactory ? `${camel(id)}()` : camel(id)),
  }
}

const registerSource = (engine, rules) => {
  const list = `[${rules.map(engine.useRule).join(', ')}]`
  const call = engine.options
    ? `(on, options) => ${engine.register}(on, ${list}, options)`
    : `on => ${engine.register}(on, ${list})`
  return [
    "import type { Register } from 'claude-code'",
    '',
    `import { ${engine.register} } from './engine'`,
    ...rules.map(engine.importRule),
    '',
    `export const register: Register = ${call}`,
    '',
  ].join('\n')
}

const userConfigFor = (engine, rules) =>
  Object.assign({}, ...rules.map(id => engine.userConfig?.[id] ?? {}))

// Copies one file into a mod. Without a nameToken it is a plain copy.
const place = (engine, mod, from, to) => {
  if (engine.nameToken === undefined) {
    mkdirSync(join(to, '..'), { recursive: true })
    copyFileSync(from, to)
    return
  }
  write(to, readFileSync(from, 'utf8').replaceAll(engine.nameToken, mod.name))
}

const buildMod = (engine, engineDir, mod, outDir) => {
  for (const id of mod.rules) {
    if (!existsSync(join(engineDir, 'hooks/rules', `${id}.ts`))) {
      throw new Error(`${mod.name}: no rule named ${id}`)
    }
  }

  rmSync(outDir, { recursive: true, force: true })
  write(join(outDir, MARKER), 'Built by scripts/build.mjs from catalog/. Edit the engine or the catalog, not this folder.\n')
  const userConfig = userConfigFor(engine, mod.rules)
  write(
    join(outDir, '.claude-plugin/plugin.json'),
    `${JSON.stringify(
      {
        name: mod.name,
        version: VERSION,
        description: mod.description,
        author: AUTHOR,
        license: LICENSE,
        ...(Object.keys(userConfig).length > 0 ? { userConfig } : {}),
        ...(engine.types === undefined ? {} : { types: `./${engine.types}` }),
      },
      null,
      2,
    )}\n`,
  )
  cpSync(join(ROOT, 'LICENSE'), join(outDir, 'LICENSE'))
  write(join(outDir, 'hooks/hooks.json'), '{ "modules": ["./register.ts"] }\n')
  write(join(outDir, 'hooks/register.ts'), registerSource(engine, mod.rules))

  // place() uses copyFileSync, which follows a symlink: a shared file may link into another engine
  if (engine.types !== undefined) place(engine, mod, join(engineDir, engine.types), join(outDir, engine.types))
  for (const file of engine.hooks) {
    place(engine, mod, join(engineDir, 'hooks', file), join(outDir, 'hooks', file))
  }
  for (const file of engine.tests) {
    place(engine, mod, join(engineDir, 'tests', file), join(outDir, 'tests', file))
  }
  for (const id of mod.rules) {
    place(engine, mod, join(engineDir, 'hooks/rules', `${id}.ts`), join(outDir, 'hooks/rules', `${id}.ts`))
    place(engine, mod, join(engineDir, 'tests', `${id}.test.ts`), join(outDir, 'tests', `${id}.test.ts`))
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
