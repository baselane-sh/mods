import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish } from '../helpers'

const TIMEOUT_MS = 2000

// [label, argv]. Each program is asked for its version and nothing else.
const PROGRAMS: readonly (readonly [string, readonly string[]])[] = [
  ['git', ['git', '--version']],
  ['node', ['node', '--version']],
  ['npm', ['npm', '--version']],
  ['python3', ['python3', '--version']],
  ['go', ['go', 'version']],
  ['rustc', ['rustc', '--version']],
  ['docker', ['docker', '--version']],
]

const version = async (tools: CommandTools, argv: readonly string[]): Promise<string> => {
  const ran = await tools.run(argv, TIMEOUT_MS)
  if (ran.timedOut) return 'timed out (2 s)'
  if (ran.code !== 0) return 'not installed'
  // Old Pythons print the version on stderr.
  const first = (ran.stdout.trim() || ran.stderr.trim()).split('\n')[0] ?? ''
  return first === '' ? 'unknown' : first.slice(0, 100)
}

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  const [os, ...found] = await Promise.all([version(tools, ['uname', '-srm']), ...PROGRAMS.map(([, argv]) => version(tools, argv))])
  const width = Math.max(...PROGRAMS.map(([label]) => label.length), 2)
  return finish(
    [
      'Environment',
      '',
      `${'os'.padEnd(width)}  ${os === 'not installed' ? 'unknown' : os}`,
      ...PROGRAMS.map(([label], i) => `${label.padEnd(width)}  ${found[i]}`),
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'envinfo',
  description: 'Print versions of git, node, npm, python3, go, rustc and docker if installed (2 s limit each), and the OS (read-only)',
  compose,
}
