import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as docker } from './rules/docker'
import { rule as k8s } from './rules/k8s'
import { rule as ciConfig } from './rules/ci-config'
import { rule as chmod } from './rules/chmod'
import { rule as gitHistory } from './rules/git-history'

export const register: Register = on => registerGuards(on, [docker, k8s, ciConfig, chmod, gitHistory])
