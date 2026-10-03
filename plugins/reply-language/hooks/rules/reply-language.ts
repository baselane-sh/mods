import type { StyleRule } from '../engine'

export const DEFAULT_LANGUAGE = 'English'

export const rule: StyleRule = {
  id: 'reply-language',
  section: options => {
    const set = options['language']
    const language = typeof set === 'string' && set.trim() !== '' ? set.trim() : DEFAULT_LANGUAGE
    return `Reply language: write every reply in ${language}. Keep code, identifiers, file paths and commands exactly as they are. Do not translate them.`
  },
}
