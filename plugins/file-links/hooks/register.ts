import type { Register } from 'claude-code'

import { drawTextWithFiles } from './hosts/text-files'
import { create as fileLinks } from './rules/file-links'

export const register: Register = on => {
  const rules = [fileLinks()]
  drawTextWithFiles(on, rules)
}
