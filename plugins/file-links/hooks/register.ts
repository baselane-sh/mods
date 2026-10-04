import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as fileLinks } from './rules/file-links'

export const register: Register = on => registerRender(on, [fileLinks()])
