import type { On, PluginOptions } from 'claude-code'

import { playAll, settingsFrom } from '../engine'
import type { SoundRule } from '../engine'

// The turn-end sound. It is its own host so a mod that has none (the bead
// chime) does not carry the hook.
export const playOnTurnEnd = (on: On, rules: readonly SoundRule[], options: PluginOptions): void => {
  const { gain, quiet } = settingsFrom(options)
  if (gain === 0 || quiet) return

  on('turn.complete', async ($, e, next) => {
    // A subagent's turn is not the person's turn.
    if (e.agentId === undefined) {
      await playAll(rules, clips => clips.turnDone, asset => $.audio.play({ asset }, { gain }), text => $.ui.log(text))
    }
    return next(e)
  })
}
