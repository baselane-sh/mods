import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as issueLinks } from './rules/issue-links'

export const register: Register = on => registerRender(on, [issueLinks()])
