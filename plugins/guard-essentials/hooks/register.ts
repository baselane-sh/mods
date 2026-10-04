import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as infra } from './rules/infra'
import { rule as prodDb } from './rules/prod-db'
import { rule as curlPipe } from './rules/curl-pipe'
import { rule as sudo } from './rules/sudo'
import { rule as envExfil } from './rules/env-exfil'
import { rule as secretValue } from './rules/secret-value'
import { rule as secretCommit } from './rules/secret-commit'
import { rule as secretOutput } from './rules/secret-output'

export const register: Register = on => registerGuards(on, [infra, prodDb, curlPipe, sudo, envExfil, secretValue, secretCommit, secretOutput])
