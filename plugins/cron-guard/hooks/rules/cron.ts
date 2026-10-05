import type { GuardRule } from '../engine'
import { base, commandsOf, hasShortFlag, subcommandOf } from '../shell'

// Commands that wipe scheduled jobs or stop system services. Nothing tells
// you later that a job stopped running. Listing, loading, starting and
// restarting pass, and so do systemd user units (--user).
const LAUNCHCTL_VERBS = new Set(['unload', 'remove', 'bootout', 'disable'])
const SYSTEMCTL_VERBS = new Set(['stop', 'disable', 'mask'])
const SYSTEMCTL_VALUE_FLAGS = new Set(['-H', '--host', '-M', '--machine', '-t', '--type', '--state', '-p', '--property', '--root', '-o', '--output', '-n', '--lines', '-s', '--signal', '--job-mode', '--kill-whom'])

// `crontab -r` removes every job; `crontab -` and `crontab <file>` replace
// the whole table with what they read.
const crontabDanger = (args: readonly string[]): string | undefined => {
  if (args.some(arg => hasShortFlag(arg, 'r'))) return 'crontab -r'
  const rest = args.filter((arg, i) => arg === '-' || (!arg.startsWith('-') && args[i - 1] !== '-u'))
  if (rest.includes('-')) return 'crontab -'
  return rest.length > 0 ? 'crontab <file>' : undefined
}

const dangerOf = (argv: readonly string[]): string | undefined => {
  const name = argv[0] === undefined ? '' : base(argv[0])
  if (name === 'crontab') return crontabDanger(argv.slice(1))
  if (name === 'launchctl') {
    const sub = argv[1]
    return sub !== undefined && LAUNCHCTL_VERBS.has(sub) ? `launchctl ${sub}` : undefined
  }
  if (name !== 'systemctl' || argv.includes('--user')) return undefined
  const { sub } = subcommandOf(argv, SYSTEMCTL_VALUE_FLAGS)
  return sub !== undefined && SYSTEMCTL_VERBS.has(sub) ? `systemctl ${sub}` : undefined
}

export const cronDangersIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => {
    const danger = dangerOf(argv)
    return danger === undefined ? [] : [danger]
  })
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'cron-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = cronDangersIn(e.command)
    return found.length === 0 ? undefined : `this wipes scheduled jobs or stops system services (${found.join(', ')}). Nothing tells you later that they stopped.`
  },
}
