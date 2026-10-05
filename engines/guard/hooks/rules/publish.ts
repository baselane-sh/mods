import type { GuardRule } from '../engine'
import { base, commandsOf, subcommandOf } from '../shell'

// Publishing puts a version on a public registry for good: the number is
// spent even if the release is pulled. Dry runs pass, and so does
// `npm run publish`, which runs a script of that name.
const VALUE_FLAGS = new Set(['--prefix', '-C', '--dir', '--cwd', '--filter', '-F', '-w', '--workspace', '--registry', '--config', '-Z', '--color', '--directory', '--project'])
// Each tool's publish subcommand, and whether it has a dry run.
const PUBLISHERS: Readonly<Record<string, { sub: string; dryRun: boolean }>> = {
  npm: { sub: 'publish', dryRun: true },
  pnpm: { sub: 'publish', dryRun: true },
  bun: { sub: 'publish', dryRun: true },
  cargo: { sub: 'publish', dryRun: true },
  poetry: { sub: 'publish', dryRun: true },
  uv: { sub: 'publish', dryRun: true },
  yarn: { sub: 'publish', dryRun: false },
  twine: { sub: 'upload', dryRun: false },
  gem: { sub: 'push', dryRun: false },
}
const PYTHON = /^python[0-9.]*$/
const RUNNERS: Readonly<Record<string, string>> = { uv: 'run', poetry: 'run', pipx: 'run' }

const isDryRun = (word: string): boolean => word === '--dry-run' || word === '--dry-run=true'

// `python -m twine` and `uv run twine` read as `twine`.
const withoutRunner = (argv: readonly string[]): readonly string[] => {
  const name = argv[0] === undefined ? '' : base(argv[0])
  if (PYTHON.test(name) && argv[1] === '-m') return argv.slice(2)
  return RUNNERS[name] !== undefined && argv[1] === RUNNERS[name] ? argv.slice(2) : argv
}

const publishOf = (argv: readonly string[]): string | undefined => {
  const name = argv[0] === undefined ? '' : base(argv[0])
  const tool = PUBLISHERS[name]
  if (tool === undefined) return undefined
  // `cargo +nightly publish`: the toolchain word is not a subcommand.
  const { sub, args } = subcommandOf(argv.filter(word => !word.startsWith('+')), VALUE_FLAGS)
  const dry = argv.some(isDryRun) || (name === 'cargo' && args.includes('-n'))
  if (tool.dryRun && dry) return undefined
  if (sub === tool.sub) return `${name} ${sub}`
  return name === 'yarn' && sub === 'npm' && args[0] === 'publish' ? 'yarn npm publish' : undefined
}

export const publishesIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => {
    const name = publishOf(withoutRunner(argv))
    return name === undefined ? [] : [name]
  })
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'publish-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = publishesIn(e.command)
    return found.length === 0 ? undefined : `this publishes a package to a registry (${found.join(', ')}). A published version cannot be reused, even if you pull it.`
  },
}
