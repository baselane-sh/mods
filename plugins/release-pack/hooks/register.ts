import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as publish } from './rules/publish'
import { rule as tag } from './rules/tag'
import { rule as deploy } from './rules/deploy'
import { rule as registryPush } from './rules/registry-push'

export const register: Register = on => registerGuards(on, [publish, tag, deploy, registryPush])
