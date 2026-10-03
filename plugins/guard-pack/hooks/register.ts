import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as secretFilename } from './rules/secret-filename'
import { rule as secretValue } from './rules/secret-value'
import { rule as envExfil } from './rules/env-exfil'
import { rule as infra } from './rules/infra'
import { rule as secretCommit } from './rules/secret-commit'
import { rule as protectMain } from './rules/protect-main'
import { rule as gitignore } from './rules/gitignore'
import { rule as secretOutput } from './rules/secret-output'

export const register: Register = on => registerGuards(on, [secretFilename, secretValue, envExfil, infra, secretCommit, protectMain, gitignore, secretOutput])
