import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { answerCommandsWithRead } from './hosts/command-read'
import { rule as tree } from './rules/tree'
import { rule as deps } from './rules/deps'
import { rule as authors } from './rules/authors'
import { rule as scripts } from './rules/scripts'
import { rule as envCheck } from './rules/env-check'

export const register: Register = on => {
  const rules = [tree, deps, authors, scripts, envCheck]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [tree, authors])
  answerCommandsWithRead(on, [deps, scripts, envCheck])
}
