import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as pathShorten } from './rules/path-shorten'

export const register: Register = on => registerRender(on, [pathShorten()])
