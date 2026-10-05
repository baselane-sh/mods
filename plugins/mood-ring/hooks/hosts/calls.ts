import { atom, update } from 'claude-code'
import type { On } from 'claude-code'

import type { Outcome, Tally } from '../../types'
import { failed } from '../engine'
import type { BandRule } from '../rule'
import { addCall } from '../tally'

const WINDOW = 20

// The same atoms as engine.tsx: the state scan wants each spelled in the
// file that reads or writes it. The build writes the mod's own name for the token.
const outcomes = atom({ plugin: 'mood-ring', key: 'outcomes' } as const, [] as readonly Outcome[])
const tally = atom({ plugin: 'mood-ring', key: 'tally' } as const, { calls: {}, failures: 0 } as Tally)

// For the rules that draw from how the tool calls ended: the recent outcomes
// and the tally of the session. The result is passed on as it came: a denied
// call stays denied. Only one hook may answer `tool.call` without a matcher.
export const watchCalls = (on: On, rules: readonly BandRule[]): void => {
  const isOutcomes = rules.some(rule => rule.tracksOutcomes === true)
  const isTally = rules.some(rule => rule.tracksTools === true)

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      const outcome: Outcome = ran.deny !== undefined ? 'block' : ran.isError === true ? 'error' : 'ok'
      if (isOutcomes) await update($, outcomes, recent => [...recent, outcome].slice(-WINDOW))
      if (isTally) await update($, tally, current => addCall(current, e.tool, outcome !== 'ok'))
    } catch (error) {
      await $.ui.log(failed('outcomes', error))
    }
    return ran
  })
}
