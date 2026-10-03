import type { GuardRule } from '../engine'
import { base, segmentsOf } from '../shell'

// Elevated rights change the whole machine, not the project. Asks before
// sudo, doas or `su -c`; text that only mentions them passes.
const SU_COMMAND = /^(--command(=.*)?|-[a-zA-Z]*c[a-zA-Z]*)$/

export const usesPrivilege = (command: string): readonly string[] => {
  const names = segmentsOf(command).flatMap(({ argv }): string[] => {
    const name = argv[0] === undefined ? undefined : base(argv[0])
    if (name === 'sudo' || name === 'doas') return [name]
    return name === 'su' && argv.slice(1).some(arg => SU_COMMAND.test(arg)) ? ['su -c'] : []
  })
  return [...new Set(names)]
}

export const rule: GuardRule = {
  id: 'sudo-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = usesPrivilege(e.command)
    return found.length === 0 ? undefined : `this runs a command with elevated rights (${found.join(', ')}). It can change the whole machine, not just the project.`
  },
}
