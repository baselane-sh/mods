import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as diffStats } from './rules/diff-stats'
import { create as fileLinks } from './rules/file-links'

export const register: Register = on => registerRender(on, [diffStats(), fileLinks()])
