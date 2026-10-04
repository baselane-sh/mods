import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as jsonPretty } from './rules/json-pretty'

export const register: Register = on => registerRender(on, [jsonPretty()])
