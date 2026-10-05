import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommands } from './hosts/command'
import { answerCommandsWithGit } from './hosts/command-git'
import { answerCommandsWithWrite } from './hosts/command-write'
import { rule as receipt } from './rules/receipt'
import { rule as standup } from './rules/standup'
import { rule as changelog } from './rules/changelog'
import { rule as prDescription } from './rules/pr-description'
import { rule as handoff } from './rules/handoff'

export const register: Register = on => {
  const rules = [receipt, standup, changelog, prDescription, handoff]
  registerCommands(on, rules)
  answerCommands(on, [receipt])
  answerCommandsWithGit(on, [standup, changelog, prDescription])
  answerCommandsWithWrite(on, [handoff])
}
