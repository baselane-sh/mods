import type { LifecycleRule, ToolTools } from '../engine'
import { redact } from '../patterns'

// After Write or Edit, runs the project's own formatter on the file, only
// when the project opted in with a config file found by walking up from the
// file (at most 12 directories):
//   prettier   .prettierrc* / prettier.config.* / "prettier" in package.json
//   biome      biome.json / biome.jsonc
//   ruff       ruff.toml / .ruff.toml / [tool.ruff] in pyproject.toml
//   black      [tool.black] in pyproject.toml
//   gofmt      go.mod
//   rustfmt    Cargo.toml
// Binaries: nearest node_modules/.bin first, then PATH. Never npx, so a hook
// can never start a network install.
//
// The reformat changes the file on disk after Claude's edit, so the next Edit
// would fail with "modified since read": the note tells the model to re-read.
const WALK_LIMIT = 12
const ERROR_CHARS = 300
const WEB_EXTENSIONS = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'css', 'scss', 'md', 'yaml', 'yml', 'html', 'vue'])

const parent = (dir: string): string => dir.slice(0, dir.lastIndexOf('/')) || '/'

type Command = { tool: string; argv: readonly string[] }

const joinPath = (dir: string, name: string): string => (dir === '/' ? `/${name}` : `${dir}/${name}`)

// Walks up from the edited file's directory. Listings are fetched once per
// level and shared by every lookup.
const finder = (tools: ToolTools, start: string) => {
  const listings = new Map<string, Promise<readonly string[]>>()
  const names = (dir: string) => {
    const known = listings.get(dir) ?? tools.list(dir).catch((): readonly string[] => [])
    listings.set(dir, known)
    return known
  }
  const walk = async (check: (dir: string) => Promise<string | undefined>): Promise<string | undefined> => {
    let dir = start
    for (let level = 0; level < WALK_LIMIT; level += 1) {
      const found = await check(dir)
      if (found !== undefined) return found
      if (dir === '/') return undefined
      dir = parent(dir)
    }
    return undefined
  }
  return {
    // Is there a name matching the pattern in this directory or above?
    has: async (match: RegExp): Promise<boolean> =>
      (await walk(async dir => ((await names(dir)).some(name => match.test(name)) ? dir : undefined))) !== undefined,
    // The text of the nearest file of that name, if any.
    nearestText: async (name: string): Promise<string | undefined> => {
      const dir = await walk(async found => ((await names(found)).includes(name) ? found : undefined))
      return dir === undefined ? undefined : tools.read(joinPath(dir, name))
    },
    // node_modules/.bin/<name> nearest up the tree (when `local`), else <name> on PATH.
    bin: async (name: string, local: boolean): Promise<string | undefined> => {
      const nearest = local
        ? await walk(async dir => {
            const path = `${joinPath(dir, 'node_modules/.bin')}/${name}`
            return (await tools.exists(path)) ? path : undefined
          })
        : undefined
      if (nearest !== undefined) return nearest
      const which = await tools.run(['which', name])
      const path = which.stdout.trim()
      return which.exitCode === 0 && path !== '' ? path : undefined
    },
  }
}

type Finder = ReturnType<typeof finder>

const webCommand = async (file: string, find: Finder): Promise<Command | undefined> => {
  if (await find.has(/^biome\.json/)) {
    const biome = await find.bin('biome', true)
    return biome === undefined ? undefined : { tool: 'biome', argv: [biome, 'format', '--write', file] }
  }
  const optedIn =
    (await find.has(/^\.prettierrc/)) ||
    (await find.has(/^prettier\.config\./)) ||
    ((await find.nearestText('package.json'))?.includes('"prettier"') ?? false)
  if (!optedIn) return undefined
  const prettier = await find.bin('prettier', true)
  return prettier === undefined ? undefined : { tool: 'prettier', argv: [prettier, '--write', '--log-level', 'warn', file] }
}

const pythonCommand = async (file: string, find: Finder): Promise<Command | undefined> => {
  const pyproject = await find.nearestText('pyproject.toml')
  if ((await find.has(/^\.?ruff\.toml$/)) || /^\[tool\.ruff/m.test(pyproject ?? '')) {
    const ruff = await find.bin('ruff', false)
    return ruff === undefined ? undefined : { tool: 'ruff', argv: [ruff, 'format', '-q', file] }
  }
  if (/^\[tool\.black\]/m.test(pyproject ?? '')) {
    const black = await find.bin('black', false)
    return black === undefined ? undefined : { tool: 'black', argv: [black, '-q', file] }
  }
  return undefined
}

const commandFor = async (file: string, find: Finder): Promise<Command | undefined> => {
  const ext = file.split('/').pop()?.split('.').pop() ?? ''
  if (WEB_EXTENSIONS.has(ext)) return webCommand(file, find)
  if (ext === 'py') return pythonCommand(file, find)
  if (ext === 'go' && (await find.has(/^go\.mod$/))) {
    const gofmt = await find.bin('gofmt', false)
    return gofmt === undefined ? undefined : { tool: 'gofmt', argv: [gofmt, '-w', file] }
  }
  if (ext === 'rs' && (await find.has(/^Cargo\.toml$/))) {
    const rustfmt = await find.bin('rustfmt', false)
    return rustfmt === undefined ? undefined : { tool: 'rustfmt', argv: [rustfmt, '--edition', '2021', file] }
  }
  return undefined
}

export const rule: LifecycleRule = {
  id: 'auto-format',
  afterTool: async ({ e }, tools) => {
    if ((e.tool !== 'Write' && e.tool !== 'Edit') || !(await tools.exists(e.file_path))) return undefined
    const file = e.file_path.startsWith('/') ? e.file_path : `${await tools.cwd()}/${e.file_path}`
    const command = await commandFor(file, finder(tools, parent(file)))
    if (command === undefined) return undefined

    const before = await tools.read(file)
    // Formatter stderr can quote source lines, so scrub credential shapes.
    const failure = (how: string, detail: string) =>
      `auto-format: ${command.tool} failed on ${file} (${how}): ${detail}. File left as written.`
    try {
      const done = await tools.run(command.argv)
      if (done.exitCode !== 0) return failure(`exit ${done.exitCode}`, redact(done.stderr).slice(0, ERROR_CHARS))
    } catch (error) {
      return failure('could not run', error instanceof Error ? error.message : String(error))
    }
    return (await tools.read(file)) === before
      ? undefined
      : `auto-format: reformatted ${file} with ${command.tool}. Its content changed on disk. Re-read the file before the next Edit to it.`
  },
}
