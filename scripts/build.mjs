// Builds one standalone plugin folder per catalog entry under plugins/, and
// the marketplace file that lists them. A plugin may import only its own
// files, so each one gets its own copy of the engine and the rules it uses.
// A mod ships only the files its generated hooks/register.ts imports, directly
// or through other files: `claude plugin validate` lists every `$` call and
// hook in that import closure, and the gallery shows them as what the mod can
// do.
//
//   node scripts/build.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const AUTHOR = { name: 'Baselane', url: 'https://baselane.sh' }
const MARKER = '.generated'
const VERSION = '0.4.0'
const LICENSE = 'MIT'

const camel = id => id.replace(/-(\w)/g, (_, c) => c.toUpperCase())

const write = (path, text) => {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, text)
}

// Each engine describes itself in engines/<name>/engine.json:
//   tests       shared test files (engine.test.ts and the like). Each is
//               copied into a mod only when every hooks/ file it imports
//               ships with that mod. A rule's own test and the helpers it
//               imports always ship with the rule.
//   register    optional: the function hooks/engine.ts exports, called with
//               (on, rules) for every mod. It registers the hooks every mod
//               of the engine uses.
//   needs       optional. { ruleId: [need] }: what a rule needs beyond the
//               engine core, named by the engine (a capability such as
//               "run", or a hook such as "after"). The build fails when
//               a key is not a rule or a need is given by no host.
//   hosts       optional. { group: [{ file, export, gives, options?, shared? }] }: a
//               host is a function `(on, rules)` in its own file that
//               registers one hook and builds the `$` closures that hook
//               hands the rules. A `$` call cannot cross an import, so a
//               capability lives in the host that uses it. For each group
//               the build picks the host with the fewest `gives` that covers
//               every need of the mod's rules that the group knows; a group
//               none of the mod's rules needs gets the host with empty
//               `gives`, or no host. `options: true` passes the userConfig
//               values as a third argument. A group may instead be
//               { perRule: true, hosts: [...] } (rules exported as values
//               only): each rule gets its own smallest host, called with
//               the rules that chose it; every rule needs one, so the
//               group has a host with empty `gives`. `shared: true` passes
//               the engine's shared value as the last argument.
//   shared      optional: a function hooks/engine.ts exports that makes what
//               register and the hosts share (timers, say). register.ts calls
//               it once and passes the value to register and to each host
//               with `shared: true`. A function that takes `on` may not
//               return a value, so it cannot hand this over itself.
//   ruleExport  "rule" (a module exports a value) or "create" (a factory,
//               called once per load, for rules that keep session state)
//   options     optional. true passes the plugin's userConfig values to
//               register as a third argument: register(on, rules, options)
//   optionsFor  optional. [ruleId]: like `options`, but only for a mod that
//               uses one of these rules, so the mods that do not keep the
//               register file they had.
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
//   assets      optional: a folder of binary files under the engine folder.
//               Each rule's own subfolder (<assets>/<ruleId>) is copied
//               byte for byte into the mod at the same path; a rule with no
//               subfolder fails the build.
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

// pickHost skips a need its group does not know (another group may give it),
// so a mistyped need or rule id would build a mod without the host its rule
// needs. Check every `needs` entry against the rules and all the hosts once.
const checkNeeds = (name, engine, engineDir) => {
  const groups = Object.values(engine.hosts ?? {}).map(entry => (Array.isArray(entry) ? entry : entry.hosts))
  const given = new Set(groups.flat().flatMap(host => host.gives))
  for (const [id, needs] of Object.entries(engine.needs ?? {})) {
    if (!existsSync(join(engineDir, 'hooks/rules', `${id}.ts`))) {
      throw new Error(`${name}: needs names "${id}", but there is no rule hooks/rules/${id}.ts`)
    }
    const missing = needs.find(need => !given.has(need))
    if (missing !== undefined) throw new Error(`${name}: rule ${id} needs "${missing}", but no host gives it`)
  }
}

// The smallest host of a group that gives every one of `needs` it knows.
const pickHost = (group, hosts, needs, what) => {
  const known = new Set(hosts.flatMap(host => host.gives))
  const wanted = [...needs].filter(need => known.has(need))
  const fits = hosts
    .filter(host => wanted.every(need => host.gives.includes(need)))
    .sort((a, b) => a.gives.length - b.gives.length)
  if (wanted.length === 0) return fits.find(host => host.gives.length === 0)
  if (fits.length === 0) throw new Error(`${what}: no ${group} host gives ${wanted.join(' and ')}`)
  return fits[0]
}

// The hosts a mod's rules need (see `hosts` above), each with the rules it is
// called with: every rule of the mod, or for a `perRule` group the rules that
// chose it.
const hostsFor = (engine, mod) => {
  const needsOf = id => engine.needs?.[id] ?? []
  return Object.entries(engine.hosts ?? {}).flatMap(([group, entry]) => {
    const { hosts, perRule } = Array.isArray(entry) ? { hosts: entry, perRule: false } : entry
    if (!perRule) {
      const host = pickHost(group, hosts, new Set(mod.rules.flatMap(needsOf)), mod.name)
      return host === undefined ? [] : [{ host }]
    }
    if (engine.ruleExport !== 'rule') throw new Error(`${group}: a perRule group needs ruleExport "rule"`)
    const chosen = mod.rules.map(id => ({ id, host: pickHost(group, hosts, new Set(needsOf(id)), `${mod.name} ${id}`) }))
    const missing = chosen.find(({ host }) => host === undefined)
    if (missing !== undefined) throw new Error(`${mod.name} ${missing.id}: the perRule group ${group} has no host with empty gives`)
    return [...new Set(chosen.map(({ host }) => host))].map(host => ({
      host,
      rules: chosen.filter(pick => pick.host === host).map(pick => pick.id),
    }))
  })
}

// A path under the engine folder, as an import from the mod's hooks/ folder.
const fromHooks = file => `./${file.replace(/^hooks\//, '').replace(/\.tsx?$/, '')}`

const registerSource = (engine, mod, picks) => {
  const rules = mod.rules
  const list = `[${rules.map(engine.useRule).join(', ')}]`
  const takesOptions = engine.options || rules.some(id => engine.optionsFor?.includes(id))
  if (engine.register === undefined && picks.length === 0) throw new Error(`${mod.name}: no register and no host`)
  const imports = [
    ...(engine.register === undefined && engine.shared === undefined
      ? []
      : [`import { ${[engine.register, engine.shared].filter(name => name !== undefined).join(', ')} } from './engine'`]),
    ...picks.map(({ host }) => `import { ${host.export} } from '${fromHooks(host.file)}'`),
    ...rules.map(engine.importRule),
  ]
  const head = ["import type { Register } from 'claude-code'", '', ...imports, '']
  // No host: the one-line form every mod had before hosts.
  if (picks.length === 0 && engine.shared === undefined) {
    const call = takesOptions
      ? `(on, options) => ${engine.register}(on, ${list}, options)`
      : `on => ${engine.register}(on, ${list})`
    return [...head, `export const register: Register = ${call}`, ''].join('\n')
  }
  const usesOptions = takesOptions || picks.some(({ host }) => host.options === true)
  // The value of `shared`, made once here, goes to register and to each host
  // that asks: a function that takes `on` may not hand a value back.
  const usesShared = engine.shared !== undefined
  if (picks.some(({ host }) => host.shared === true) && !usesShared) throw new Error(`${mod.name}: a host asks for shared, but the engine has no shared`)
  const withOptions = (args, options) => `${args}${options ? ', options' : ''}`
  const core = engine.register === undefined ? [] : [`  ${engine.register}(on, ${withOptions('rules', takesOptions)}${usesShared ? ', shared' : ''})`]
  const calls = picks.map(({ host, rules: some }) => {
    const args = some === undefined ? 'rules' : `[${some.map(camel).join(', ')}]`
    return `  ${host.export}(on, ${withOptions(args, host.options === true)}${host.shared === true ? ', shared' : ''})`
  })
  return [
    ...head,
    `export const register: Register = ${usesOptions ? '(on, options)' : 'on'} => {`,
    `  const rules = ${list}`,
    ...(usesShared ? [`  const shared = ${engine.shared}()`] : []),
    ...core,
    ...calls,
    '}',
    '',
  ].join('\n')
}

// The relative files a source file imports, as paths under the engine folder.
// Covers `import ... from`, `import type`, `export ... from` and a bare
// `import './x'`; an extensionless path resolves as the bundler does.
const IMPORT = /(?:^|\n)\s*(?:import|export)\s(?:[^'"]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/g
const EXTENSIONS = ['', '.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx', '/index.d.ts']

const importsOf = (engineDir, file, source = readFileSync(join(engineDir, file), 'utf8')) => [...source.matchAll(IMPORT)].map(match => {
    const base = join(dirname(file), match[1])
    const found = EXTENSIONS.map(ext => base + ext).find(path => existsSync(join(engineDir, path)) && !statSync(join(engineDir, path)).isDirectory())
    if (found === undefined) throw new Error(`${file}: cannot resolve ${match[1]}`)
    return found
  })

// Every file reachable from `starts` through relative imports, starts included.
const closureOf = (engineDir, starts) => {
  const seen = new Set()
  const visit = file => {
    if (seen.has(file)) return
    seen.add(file)
    importsOf(engineDir, file).forEach(visit)
  }
  starts.forEach(visit)
  return seen
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

// A plain recursive copy: the files are binary, so they never go through
// place(), which reads and rewrites text.
const copyAssets = (engine, mod, engineDir, outDir) => {
  for (const id of mod.rules) {
    const from = join(engineDir, engine.assets, id)
    if (!existsSync(from)) throw new Error(`${mod.name}: no assets folder ${join(engine.assets, id)}`)
    cpSync(from, join(outDir, engine.assets, id), { recursive: true })
  }
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
  const register = registerSource(engine, mod, hostsFor(engine, mod))
  write(join(outDir, 'hooks/register.ts'), register)

  // What register.ts imports, then everything those files import.
  const shipped = closureOf(engineDir, importsOf(engineDir, 'hooks/register.ts', register))
  const ruleTests = closureOf(engineDir, mod.rules.map(id => join('tests', `${id}.test.ts`)))
  // A shared test ships only when the hooks files it imports ship too.
  const sharedTests = (engine.tests ?? [])
    .map(file => closureOf(engineDir, [join('tests', file)]))
    .filter(files => [...files].every(file => !file.startsWith('hooks/') || shipped.has(file)))
  const files = new Set([
    ...shipped,
    ...ruleTests,
    ...sharedTests.flatMap(set => [...set]),
    ...(engine.types === undefined ? [] : [engine.types]),
  ])

  for (const file of [...files].sort()) place(engine, mod, engineDir, outDir, file)
  if (engine.assets !== undefined) copyAssets(engine, mod, engineDir, outDir)
}

const catalogs = readdirSync(join(ROOT, 'catalog'))
  .filter(file => file.endsWith('.json'))
  .map(file => JSON.parse(readFileSync(join(ROOT, 'catalog', file), 'utf8')))

const mods = catalogs.flatMap(catalog => {
  if (!existsSync(join(ROOT, 'engines', catalog.engine, 'engine.json'))) {
    throw new Error(`unknown engine ${catalog.engine}`)
  }
  const engine = loadEngine(catalog.engine)
  checkNeeds(catalog.engine, engine, join(ROOT, 'engines', catalog.engine))
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
      name: 'baselane-mods-dev',
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
