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
const VERSION = '0.2.0'
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
//   stateOwner  optional. { name, files }: only the plugin that owns a `$.state`
//               value may write it, and the owner is the mod's name. The engine
//               source writes `name` as the owner (a literal, which the host
//               requires); in each listed file (paths under the engine folder)
//               the build swaps `'name'` and a bare `name` for the mod's name.
//               For a mod called `name` nothing changes.
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

// A name that is not a valid identifier (`command-pack`) needs quotes as a key.
const asKey = name => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : `'${name}'`)

const withOwner = (engine, modName, file, source) => {
  if (engine.stateOwner === undefined || !engine.stateOwner.files.includes(file)) return source
  const owner = engine.stateOwner.name
  const pattern = new RegExp(`'${owner}'|\\b${owner}\\b`, 'g')
  let swaps = 0
  const swapped = source.replace(pattern, found => {
    swaps += 1
    return found.startsWith("'") ? `'${modName}'` : asKey(modName)
  })
  // A file that never named the owner would ship with a state owner that is not the mod.
  if (swaps === 0) throw new Error(`${modName}: ${file} never names the state owner '${owner}'`)
  return swapped
}

// Copies one engine file (a path under the engine folder) into a mod at the
// same path, swapping the nameToken and the state owner where the engine
// asks for it. readFileSync follows a symlink: a shared file may link into
// another engine.
const place = (engine, mod, engineDir, outDir, file) => {
  const source = readFileSync(join(engineDir, file), 'utf8')
  const named = engine.nameToken === undefined ? source : source.replaceAll(engine.nameToken, mod.name)
  write(join(outDir, file), withOwner(engine, mod.name, file, named))
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

  const copy = file => place(engine, mod, engineDir, outDir, file)
  if (engine.types !== undefined) copy(engine.types)
  for (const file of engine.hooks) copy(join('hooks', file))
  for (const file of engine.tests) copy(join('tests', file))
  for (const id of mod.rules) {
    copy(join('hooks/rules', `${id}.ts`))
    copy(join('tests', `${id}.test.ts`))
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
