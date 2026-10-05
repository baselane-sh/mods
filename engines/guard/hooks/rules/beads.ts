import type { GuardRule } from '../engine'
import { base, commandsOf, subcommandOf } from '../shell'

// bd commands that delete issues, rewrite history or run raw SQL. Reads
// (list, show, ready, status, count, stale), writes of one issue (create,
// update, close) and `--dry-run` previews pass. Only the command text is read.
const BD_VALUE_FLAGS = new Set(['-C', '--directory', '--db', '--actor', '--dolt-auto-commit'])

// Always destructive: they delete issues or history, or run raw SQL.
const ALWAYS = new Set(['delete', 'purge', 'prune', 'flatten', 'compact', 'gc', 'rename-prefix', 'sql', 'admin'])

const firstWord = (args: readonly string[]): string | undefined => args.find(arg => !arg.startsWith('-'))

const bdDanger = (argv: readonly string[]): string[] => {
  const { sub, args } = subcommandOf(argv, BD_VALUE_FLAGS)
  if (sub === undefined || args.includes('--dry-run')) return []
  if (ALWAYS.has(sub)) return [`bd ${sub}`]
  if (sub === 'init' && args.includes('--force')) return ['bd init --force']
  if (sub === 'duplicates' && args.includes('--auto-merge')) return ['bd duplicates --auto-merge']
  // `bd vc commit` is a plain commit; `bd vc merge` changes the data of the current branch.
  if (sub === 'vc' && firstWord(args) === 'merge') return ['bd vc merge']
  if (sub === 'dolt' && firstWord(args) === 'push' && args.includes('--force')) return ['bd dolt push --force']
  return []
}

export const beadsDangersIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => (argv[0] !== undefined && base(argv[0]) === 'bd' ? bdDanger(argv) : []))
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'beads',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = beadsDangersIn(e.command)
    return found.length === 0 ? undefined : `this deletes beads issues or rewrites the beads history (${found.join(', ')}).`
  },
}
