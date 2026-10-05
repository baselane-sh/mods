import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as hotspots } from './rules/hotspots'

export const register: Register = on => {
  const rules = [hotspots]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [hotspots])
}
