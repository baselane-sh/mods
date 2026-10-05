import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as shaLinks } from './rules/sha-links'

export const register: Register = on => registerRender(on, [shaLinks()])
