import type { On } from 'claude-code'

import { sectionId } from '../engine'
import type { StyleRule } from '../engine'

// bd answers in about 0.5 s on a large repo; 10 s is the limit.
const RUN_TIMEOUT_MS = 10_000

// The sections of rules whose text comes from a program. Each rule's `live`
// runs once per session, on the first prompt.compose, and what it returned
// (or that it returned nothing) is kept: a failed run is not tried again.
export const addLiveSections = (on: On, rules: readonly StyleRule[]): void => {
  const live = rules.filter(rule => rule.live !== undefined)
  if (live.length === 0) return
  let fetched: Promise<readonly { id: string; text: string; scope: 'session' }[]> | undefined

  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)
    fetched ??= Promise.all(
      live.map(async rule => {
        try {
          const text = await rule.live?.(async argv => {
            // The session's folder, not the process's: bd finds .beads from there.
            const cwd = await $.session.cwd()
            const done = await $.process.run(argv, { cwd, timeoutMs: RUN_TIMEOUT_MS })
            return { exitCode: done.exitCode, stdout: done.stdout }
          })
          return text === undefined ? [] : [{ id: sectionId(rule), text, scope: 'session' as const }]
        } catch {
          return []
        }
      }),
    ).then(parts => parts.flat())
    const added = await fetched
    const ids = new Set(added.map(section => section.id))
    return { sections: [...sections.filter(section => !ids.has(section.id)), ...added] }
  })
}
