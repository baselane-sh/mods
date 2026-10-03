import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as secretFilename } from './rules/secret-filename'
import { rule as secretValue } from './rules/secret-value'
import { rule as envExfil } from './rules/env-exfil'
import { rule as infra } from './rules/infra'

export const register: Register = on => registerGuards(on, [secretFilename, secretValue, envExfil, infra])
