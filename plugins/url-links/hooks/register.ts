import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as urlLinks } from './rules/url-links'

export const register: Register = on => registerRender(on, [urlLinks()])
