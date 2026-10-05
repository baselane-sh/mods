import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithBd } from './hosts/command-bd'
import { rule as bead } from './rules/bead'

export const register: Register = on => {
  const rules = [bead]
  registerCommands(on, rules)
  answerCommandsWithBd(on, [bead])
}
