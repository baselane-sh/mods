import type { LifecycleRule, ToolTools } from '../engine'
import { redact } from '../patterns'

// After Write or Edit, runs the project's own linter fix on the file, only
// when the file lies inside the session's project root and the project opted
// in with that linter's config, found between the file and the root:
//   eslint         eslint.config.* / .eslintrc* / "eslintConfig" in package.json
//   ruff           ruff.toml / .ruff.toml / [tool.ruff] in pyproject.toml
//   golangci-lint  .golangci.yml / .yaml / .toml / .json
// Binaries: the nearest node_modules/.bin inside the project for eslint, then
// PATH. Never npx, so a hook can never start a network install.
const ERROR_CHARS = 300
const ESLINT_EXTENSIONS = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts'])

const parent = (dir: string): string => dir.slice(0, dir.lastIndexOf('/')) || '/'
const joinPath = (dir: string, name: string): string => (dir === '/' ? `/${name}` : `${dir}/${name}`)

// Resolves `.` and `..`, so `/proj/../etc/x` cannot pass for a project file.
const normalize = (path: string): string =>
  `/${path
    .split('/')
    .reduce<readonly string[]>((parts, part) => (part === '' || part === '.' ? parts : part === '..' ? parts.slice(0, -1) : [...parts, part]), [])
    .join('/')}`

const isInside = (file: string, root: string): boolean => file.startsWith(root === '/' ? '/' : `${root}/`)

// Walks up from `start` to `root`, never above it.
const finder = (tools: ToolTools, start: string, root: string) => {
  const listings = new Map<string, Promise<readonly string[]>>()
  const names = (dir: string) => {
    const known = listings.get(dir) ?? tools.list(dir).catch((): readonly string[] => [])
    listings.set(dir, known)
    return known
  }
  const walk = async (check: (dir: string) => Promise<boolean>): Promise<string | undefined> => {
    for (let dir = start; ; dir = parent(dir)) {
      if (await check(dir)) return dir
      if (dir === root || dir === '/') return undefined
    }
  }
  return {
    // The nearest directory holding a name that matches.
    dirOf: (match: RegExp) => walk(async dir => (await names(dir)).some(name => match.test(name))),
    // The nearest directory whose file of that name contains the text.
    dirWithText: (name: string, match: RegExp) =>
      walk(async dir => (await names(dir)).includes(name) && match.test(await tools.read(joinPath(dir, name)))),
    bin: async (name: string, local: boolean): Promise<string | undefined> => {
      const nearest = local ? await walk(dir => tools.exists(joinPath(dir, `node_modules/.bin/${name}`))) : undefined
      if (nearest !== undefined) return joinPath(nearest, `node_modules/.bin/${name}`)
      const which = await tools.run(['which', name])
      const path = which.stdout.trim()
      return which.exitCode === 0 && path !== '' ? path : undefined
    },
  }
}

type Finder = ReturnType<typeof finder>
type Command = { tool: string; argv: readonly string[]; cwd: string }

const eslint = async (file: string, find: Finder): Promise<Command | undefined> => {
  const dir =
    (await find.dirOf(/^eslint\.config\.[cm]?[jt]s$/)) ??
    (await find.dirOf(/^\.eslintrc(\.(js|cjs|json|ya?ml))?$/)) ??
    (await find.dirWithText('package.json', /"eslintConfig"/))
  const bin = dir === undefined ? undefined : await find.bin('eslint', true)
  return dir === undefined || bin === undefined ? undefined : { tool: 'eslint', argv: [bin, '--fix', file], cwd: dir }
}

const ruff = async (file: string, find: Finder): Promise<Command | undefined> => {
  const dir = (await find.dirOf(/^\.?ruff\.toml$/)) ?? (await find.dirWithText('pyproject.toml', /^\[tool\.ruff/m))
  const bin = dir === undefined ? undefined : await find.bin('ruff', false)
  return dir === undefined || bin === undefined
    ? undefined
    : { tool: 'ruff', argv: [bin, 'check', '--fix', '--force-exclude', '--quiet', file], cwd: dir }
}

// golangci-lint type-checks a whole package, so it runs on the file's directory.
const golangci = async (file: string, find: Finder): Promise<Command | undefined> => {
  const dir = await find.dirOf(/^\.golangci\.(ya?ml|toml|json)$/)
  const bin = dir === undefined ? undefined : await find.bin('golangci-lint', false)
  return dir === undefined || bin === undefined ? undefined : { tool: 'golangci-lint', argv: [bin, 'run', '--fix', '.'], cwd: parent(file) }
}

const commandFor = (file: string, find: Finder): Promise<Command | undefined> => {
  const ext = file.split('/').pop()?.split('.').pop() ?? ''
  if (ESLINT_EXTENSIONS.has(ext)) return eslint(file, find)
  if (ext === 'py') return ruff(file, find)
  if (ext === 'go') return golangci(file, find)
  return Promise.resolve(undefined)
}

const REREAD = 'Its content changed on disk. Re-read the file before the next Edit to it.'

export const rule: LifecycleRule = {
  id: 'auto-lint',
  afterTool: async ({ e }, tools) => {
    if (e.tool !== 'Write' && e.tool !== 'Edit') return undefined
    const root = normalize(await tools.root())
    const file = normalize(e.file_path.startsWith('/') ? e.file_path : `${await tools.cwd()}/${e.file_path}`)
    if (!isInside(file, root) || !(await tools.exists(file))) return undefined
    const command = await commandFor(file, finder(tools, parent(file), root))
    if (command === undefined) return undefined

    const before = await tools.read(file)
    // Linter output can quote source lines, so scrub credential shapes.
    const detail = (text: string) => redact(text.trim()).slice(0, ERROR_CHARS)
    const done = await tools.run(command.argv, command.cwd).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))))
    if (done instanceof Error) return `auto-lint: ${command.tool} failed on ${file} (could not run): ${done.message}`
    const changed = (await tools.read(file)) !== before
    const reread = changed ? ` ${REREAD}` : ''
    if (done.exitCode === 1) {
      return `auto-lint: ${command.tool} found problems it could not fix in ${file}: ${detail(`${done.stdout}\n${done.stderr}`)}${reread}`
    }
    if (done.exitCode !== 0) return `auto-lint: ${command.tool} failed on ${file} (exit ${done.exitCode}): ${detail(done.stderr)}${reread}`
    return changed ? `auto-lint: ${command.tool} fixed ${file}. ${REREAD}` : undefined
  },
}
