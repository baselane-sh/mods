import type { GuardRule } from '../engine'
import { base, segmentsOf } from '../shell'
import type { Segment } from '../shell'

// Git hooks are where a project's lint, test and secret checks run. Asks
// when a command switches them off.
const HOOKED = new Set(['commit', 'push', 'merge', 'rebase', 'am', 'pull'])
// Global options that take the next word as their value.
const GLOBAL_WITH_VALUE = new Set(['-C', '--git-dir', '--work-tree', '--namespace', '--exec-path'])
// Flags of git commit whose value is the next word; a value can start with a dash.
const COMMIT_VALUE_FLAGS = new Set(['-m', '-F', '-C', '-c', '-t', '--message', '--file', '--reuse-message', '--reedit-message', '--template', '--author', '--date'])
const SHORT_VALUE_LETTERS = 'mFCct'
const HOOKS_OFF = new Set(['/dev/null', '', 'nul'])

type GitCall = { configs: readonly string[]; sub: string | undefined; args: readonly string[] }

const parseGit = (argv: readonly string[]): GitCall => {
  const configs: string[] = []
  let i = 1
  while (i < argv.length && argv[i]!.startsWith('-')) {
    const word = argv[i]!
    if (word === '-c') configs.push(argv[i + 1] ?? '')
    i += word === '-c' || GLOBAL_WITH_VALUE.has(word) ? 2 : 1
  }
  return { configs, sub: argv[i], args: argv.slice(i + 1) }
}

// Walks the arguments of one git subcommand, skipping option values and
// anything after `--`. `wanted` says whether a word is the flag looked for.
const flagsIn = (args: readonly string[], valueFlags: ReadonlySet<string>, wanted: (word: string) => boolean): boolean => {
  let skip = false
  for (const word of args) {
    if (skip) {
      skip = false
    } else if (word === '--') {
      return false
    } else if (wanted(word)) {
      return true
    } else {
      skip = valueFlags.has(word) || endsWithValueLetter(word)
    }
  }
  return false
}

// -nm and -anm: a short cluster. Letters after a value letter are its value.
const shortCluster = /^-[a-zA-Z]+$/
const clusterHasN = (word: string): boolean => {
  if (!shortCluster.test(word)) return false
  for (const letter of word.slice(1)) {
    if (letter === 'n') return true
    if (SHORT_VALUE_LETTERS.includes(letter)) return false
  }
  return false
}
const endsWithValueLetter = (word: string): boolean => shortCluster.test(word) && SHORT_VALUE_LETTERS.includes(word.at(-1)!)

const hooksPathOff = (config: string): boolean => {
  const eq = config.indexOf('=')
  return eq > 0 && config.slice(0, eq).toLowerCase() === 'core.hookspath' && HOOKS_OFF.has(config.slice(eq + 1).toLowerCase())
}

const fromGit = (segment: Segment): string[] => {
  const { configs, sub, args } = parseGit(segment.argv)
  const found: string[] = []
  if (sub !== undefined && HOOKED.has(sub) && flagsIn(args, COMMIT_VALUE_FLAGS, word => word === '--no-verify')) found.push('--no-verify')
  if (sub === 'commit' && flagsIn(args, COMMIT_VALUE_FLAGS, clusterHasN)) found.push('commit -n')
  const configSet = sub === 'config' && args.some((arg, i) => arg.toLowerCase() === 'core.hookspath' && HOOKS_OFF.has((args[i + 1] ?? '').toLowerCase()))
  if (configs.some(hooksPathOff) || configSet) found.push('core.hooksPath=/dev/null')
  return found
}

// HUSKY=0 matters when it rides on a git command or is set for the shell
// ahead of one. `HUSKY=0 npm install` (skip husky's own install) passes.
const huskyOff = (segment: Segment): boolean => {
  const name = segment.argv[0] === undefined ? undefined : base(segment.argv[0])
  const isGit = name === 'git'
  const isBare = name === undefined
  return (
    ((isGit || isBare) && segment.env.includes('HUSKY=0')) ||
    (name === 'export' && segment.argv.slice(1).includes('HUSKY=0'))
  )
}

export const skippedHooksIn = (command: string): readonly string[] => {
  const found = segmentsOf(command).flatMap(segment => [
    ...(segment.argv[0] !== undefined && base(segment.argv[0]) === 'git' ? fromGit(segment) : []),
    ...(huskyOff(segment) ? ['HUSKY=0'] : []),
  ])
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'no-verify-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = skippedHooksIn(e.command)
    return found.length === 0 ? undefined : `this skips git hooks (${found.join(', ')}), so the project's lint, test and secret checks will not run.`
  },
}
