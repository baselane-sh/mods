import { pairs, sections, stringArray, versionOf } from './toml'

// One direct dependency. `kind` is set for anything but a plain runtime one.
export type Dep = { name: string; version: string; kind?: string }

const dep = (name: string, version: string, kind?: string): Dep => ({ name, version, ...(kind === undefined ? {} : { kind }) })

const NPM_KINDS: readonly [string, string | undefined][] = [
  ['dependencies', undefined],
  ['devDependencies', 'dev'],
  ['peerDependencies', 'peer'],
  ['optionalDependencies', 'optional'],
]

// Undefined when the text is not JSON (the message is not echoed: a parse error repeats the input).
export const npmDeps = (text: string): Dep[] | undefined => {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return undefined
  }
  if (typeof data !== 'object' || data === null) return undefined
  const table = data as Record<string, unknown>
  return NPM_KINDS.flatMap(([field, kind]) => {
    const found = table[field]
    if (typeof found !== 'object' || found === null) return []
    return Object.entries(found).map(([name, version]) => dep(name, typeof version === 'string' ? version : '*', kind))
  })
}

// "requests>=2.31 ; python_version < '3.11'" and "pydantic[email]>=2,<3" are
// a name and the version spec; the extras and the marker are left out.
const REQUIREMENT = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:\[[^\]]*\])?\s*([<>=!~][^;]*?)?\s*(?:;.*)?$/

const requirement = (spec: string, kind?: string): Dep | undefined => {
  const hit = REQUIREMENT.exec(spec.trim())
  return hit === null ? undefined : dep(hit[1] ?? spec, (hit[2] ?? '').replace(/\s+/g, '') || '*', kind)
}

const present = (found: (Dep | undefined)[]): Dep[] => found.filter((d): d is Dep => d !== undefined)

export const pyprojectDeps = (text: string): Dep[] => {
  const all = sections(text)
  const poetry = (name: string, kind?: string): Dep[] =>
    pairs(all.get(name) ?? []).filter(([key]) => key !== 'python').map(([key, value]) => dep(key, versionOf(value), kind))
  return [
    ...present((stringArray(all.get('project') ?? [], 'dependencies') ?? []).map(spec => requirement(spec))),
    ...pairs(all.get('project.optional-dependencies') ?? []).flatMap(([group]) =>
      present((stringArray(all.get('project.optional-dependencies') ?? [], group) ?? []).map(spec => requirement(spec, 'optional'))),
    ),
    ...poetry('tool.poetry.dependencies'),
    ...poetry('tool.poetry.dev-dependencies', 'dev'),
    ...[...all.keys()]
      .filter(name => /^tool\.poetry\.group\.[^.]+\.dependencies$/.test(name))
      .flatMap(name => poetry(name, 'dev')),
  ]
}

// Lines that set an option or pull in another file are not requirements.
export const requirementsDeps = (text: string): Dep[] =>
  text.split('\n').flatMap(row => {
    const line = row.replace(/\s#.*$/, '').trim()
    if (line === '' || line.startsWith('#') || line.startsWith('-')) return []
    return [requirement(line) ?? dep(line, '*')]
  })

export const goDeps = (text: string): Dep[] => {
  let inBlock = false
  const found: Dep[] = []
  for (const row of text.split('\n')) {
    const line = row.trim()
    if (inBlock && line === ')') inBlock = false
    else if (/^require\s*\($/.test(line)) inBlock = true
    else if (!line.startsWith('//')) {
      const hit = (inBlock ? /^(\S+)\s+(\S+)(.*)$/ : /^require\s+(\S+)\s+(\S+)(.*)$/).exec(line)
      if (hit !== null && !/\/\/\s*indirect/.test(hit[3] ?? '')) found.push(dep(hit[1] ?? '', hit[2] ?? '*'))
    }
  }
  return found
}

const CARGO_KINDS: readonly [string, string | undefined][] = [
  ['dependencies', undefined],
  ['dev-dependencies', 'dev'],
  ['build-dependencies', 'build'],
]

export const cargoDeps = (text: string): Dep[] => {
  const all = sections(text)
  return CARGO_KINDS.flatMap(([table, kind]) => [
    ...pairs(all.get(table) ?? []).map(([name, value]) => dep(name, versionOf(value), kind)),
    // [dependencies.tokio] with its own rows.
    ...[...all]
      .filter(([name]) => name.startsWith(`${table}.`))
      .map(([name, body]) => dep(name.slice(table.length + 1), pairs(body).find(([key]) => key === 'version')?.[1].replace(/^["']|["']$/g, '') ?? '*', kind)),
  ])
}
