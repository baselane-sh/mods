import type { On, PluginOptions } from 'claude-code'

import { sectionId, textOf } from '../engine'
import type { StyleRule } from '../engine'

// Answers prompt.compose with everything the engine and the plugins beneath
// composed, plus one section per rule at the end. A section that already has
// the same id is replaced, so the ids in the list stay unique. A rule that
// gives `live` is for the live host, not this one.
export const addStaticSections = (on: On, all: readonly StyleRule[], options: PluginOptions): void => {
  const rules = all.filter(rule => rule.live === undefined)
  on('prompt.compose', async (_$, e, next) => {
    const { sections } = await next(e)
    const added = rules.map(rule => ({ id: sectionId(rule), text: textOf(rule, options), scope: 'session' as const }))
    const ids = new Set(added.map(section => section.id))
    return { sections: [...sections.filter(section => !ids.has(section.id)), ...added] }
  })
}
