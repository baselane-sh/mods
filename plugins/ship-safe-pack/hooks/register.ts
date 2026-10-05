import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as publish } from './rules/publish'
import { rule as tag } from './rules/tag'
import { rule as deploy } from './rules/deploy'
import { rule as registryPush } from './rules/registry-push'
import { rule as dbReset } from './rules/db-reset'
import { rule as upload } from './rules/upload'

export const register: Register = on => registerGuards(on, [publish, tag, deploy, registryPush, dbReset, upload])
