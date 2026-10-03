import type { GuardRule } from '../engine'
import { base, segmentsOf, withoutSudo } from '../shell'

// A new dependency is code from a stranger that runs with your rights.
// Asks when a command adds one and names it. A bare install (from the
// manifest or lockfile) adds nothing new and passes.
type Manager = {
  // Subcommands that add the packages named after them.
  adds: readonly string[]
  // Options that take the next word as their value (so it is not a package).
  valueFlags: readonly string[]
}

const NPM_LIKE: Manager = {
  adds: ['install', 'i', 'in', 'add'],
  valueFlags: ['--prefix', '-w', '--workspace', '--registry', '--cwd', '--dir', '-C', '--filter', '-F', '--tag', '--cache'],
}
const PIP: Manager = {
  adds: ['install'],
  valueFlags: ['-r', '--requirement', '-e', '--editable', '-c', '--constraint', '-i', '--index-url', '--extra-index-url', '-t', '--target', '--prefix', '--root', '-f', '--find-links', '--python', '-p'],
}
const UV: Manager = {
  adds: ['add'],
  valueFlags: ['-r', '--requirements', '--group', '--extra', '--index', '-p', '--python', '--project', '--directory', '-c', '--constraints', '--package', '--branch', '--tag', '--rev', '--editable', '-e'],
}

const MANAGERS: Readonly<Record<string, Manager>> = {
  npm: NPM_LIKE,
  pnpm: { ...NPM_LIKE, adds: ['add', 'install', 'i'] },
  yarn: { ...NPM_LIKE, adds: ['add'] },
  bun: { ...NPM_LIKE, adds: ['add', 'a', 'install', 'i'] },
  pip: PIP,
  pip3: PIP,
  poetry: { adds: ['add'], valueFlags: ['-E', '--extras', '-G', '--group', '--source', '-C', '--directory', '--python', '--platform'] },
  cargo: { adds: ['add'], valueFlags: ['-F', '--features', '-p', '--package', '--manifest-path', '--rename', '--registry', '--git', '--branch', '--tag', '--rev', '--path', '--target'] },
  go: { adds: ['get'], valueFlags: [] },
  gem: { adds: ['install'], valueFlags: ['-v', '--version', '-i', '--install-dir', '-n', '--bindir', '--source', '-s', '--platform', '-P'] },
}

const PATH_LIKE = /^[./~]/

// The package names after the add subcommand, or none.
const namesFor = (manager: Manager, argv: readonly string[]): readonly string[] => {
  const names: string[] = []
  let sub: string | undefined
  let skip = false
  for (const word of argv) {
    if (skip) {
      skip = false
    } else if (word === '--') {
      continue
    } else if (word.startsWith('-')) {
      skip = manager.valueFlags.includes(word)
    } else if (sub === undefined) {
      sub = word
      if (!manager.adds.includes(word)) return []
    } else if (!PATH_LIKE.test(word)) {
      names.push(word)
    }
  }
  return names
}

// python -m pip and uv pip are pip; `uv tool install` adds a tool.
const manageFor = (argv: readonly string[]): { manager: Manager; args: readonly string[] } | undefined => {
  const [first, ...rest] = argv
  if (first === undefined) return undefined
  const name = base(first)
  if (/^python[\d.]*$/.test(name) && rest[0] === '-m' && rest[1] === 'pip') return { manager: PIP, args: rest.slice(2) }
  if (name === 'uv' && rest[0] === 'pip') return { manager: PIP, args: rest.slice(1) }
  if (name === 'uv' && rest[0] === 'tool') return { manager: { ...UV, adds: ['install'] }, args: rest.slice(1) }
  const manager = name === 'uv' ? UV : MANAGERS[name]
  return manager === undefined ? undefined : { manager, args: rest }
}

export const packagesIn = (command: string): readonly string[] =>
  segmentsOf(command).flatMap(({ argv }) => {
    const found = manageFor(withoutSudo(argv))
    return found === undefined ? [] : namesFor(found.manager, found.args)
  })

export const rule: GuardRule = {
  id: 'package-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = packagesIn(e.command)
    return found.length === 0 ? undefined : `this installs a new dependency (${found.join(', ')}). Check the package is the one you mean and worth the supply-chain risk.`
  },
}
