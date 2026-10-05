import type { On, PluginOptions } from 'claude-code'

import { closesBead } from './bead'
import { TEST_RUNNER } from './runner'

// The sounds of a rule, as paths inside the plugin folder. A pack names the
// first four; a rule that plays for one event names only that one, and the
// events it leaves out stay silent.
export type Clips = {
  testPass?: string
  testFail?: string
  denied?: string
  turnDone?: string
  beadClosed?: string
}

// One sound rule: it maps each event to a file under assets/<id>/.
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
export const playAll = async (
  rules: readonly SoundRule[],
  pick: (clips: Clips) => string | undefined,
  audio: Play,
  log: (text: string) => unknown,
): Promise<void> => {
  for (const rule of rules) {
    try {
      const clip = pick(rule.clips)
      if (clip !== undefined) await audio(clip)
    } catch (error) {
      await log(failed(rule.id, error))
    }
  }
}

// The events a finished tool call stands for, as the clip each one plays.
const picksFor = (e: { tool: string; command?: string }, ran: { deny?: string; isError?: boolean }): ((clips: Clips) => string | undefined)[] => {
  if (ran.deny !== undefined) return [clips => clips.denied]
  if (e.tool !== 'Bash' || e.command === undefined) return []
  const picks: ((clips: Clips) => string | undefined)[] = []
  if (TEST_RUNNER.test(e.command)) picks.push(ran.isError === true ? clips => clips.testFail : clips => clips.testPass)
  // Only a close that ended with exit 0 chimes.
  if (ran.isError !== true && closesBead(e.command)) picks.push(clips => clips.beadClosed)
  return picks
}

// The sound registration shared by every sound mod: what a tool call plays.
// The turn-end sound is a host (hosts/turn.ts), so a mod without one does not
// list the hook.
export const registerSounds = (on: On, rules: readonly SoundRule[], options: PluginOptions): void => {
  const { gain } = settingsFrom(options)
  // Gain 0 is silence: skip the call rather than start a muted player.
  if (gain === 0) return

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    for (const pick of picksFor(e, ran)) {
      await playAll(rules, pick, asset => $.audio.play({ asset }, { gain }), text => $.ui.log(text))
    }
    return ran
  })
}
