import type { On, PluginOptions } from 'claude-code'

import { TEST_RUNNER } from './runner'

// The four sounds of a pack, as paths inside the plugin folder.
export type Clips = {
  testPass: string
  testFail: string
  denied: string
  turnDone: string
}

// One sound pack: it maps each event to a file under assets/<id>/.
export type SoundRule = { id: string; clips: Clips }

// The plugin's userConfig values, checked. `gain` is $.audio.play's linear
// gain (0 to 4).
export type Settings = { gain: number; quiet: boolean }

const DEFAULT_GAIN = 1
const MAX_GAIN = 4

export const settingsFrom = (options: PluginOptions): Settings => {
  const volume = options['volume']
  const valid = typeof volume === 'number' && Number.isFinite(volume) && volume >= 0
  return { gain: valid ? Math.min(volume, MAX_GAIN) : DEFAULT_GAIN, quiet: options['quiet'] === true }
}

const failed = (id: string, error: unknown): string =>
  `${id}: no sound, ${error instanceof Error ? error.message : String(error)}`

type Play = (asset: string) => Promise<void>

// A clip that cannot play is logged and dropped: a sound never changes what
// a tool call or a turn does. `audio` is a closure over the hook's `$`.
const playAll = async (
  rules: readonly SoundRule[],
  pick: (clips: Clips) => string,
  audio: Play,
  log: (text: string) => unknown,
): Promise<void> => {
  for (const rule of rules) {
    try {
      await audio(pick(rule.clips))
    } catch (error) {
      await log(failed(rule.id, error))
    }
  }
}

export const registerSounds = (on: On, rules: readonly SoundRule[], options: PluginOptions): void => {
  const { gain, quiet } = settingsFrom(options)
  // Gain 0 is silence: skip the call rather than start a muted player.
  if (gain === 0) return

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    let pick: ((clips: Clips) => string) | undefined
    if (ran.deny !== undefined) pick = clips => clips.denied
    else if (e.tool === 'Bash' && TEST_RUNNER.test(e.command)) {
      pick = ran.isError === true ? clips => clips.testFail : clips => clips.testPass
    }
    if (pick !== undefined) {
      await playAll(rules, pick, asset => $.audio.play({ asset }, { gain }), text => $.ui.log(text))
    }
    return ran
  })

  if (quiet) return

  // A subagent's turn is not the person's turn.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await playAll(rules, clips => clips.turnDone, asset => $.audio.play({ asset }, { gain }), text => $.ui.log(text))
    }
    return next(e)
  })
}
