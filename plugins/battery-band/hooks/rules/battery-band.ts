import type { Fetched } from '../../types'
import type { BandRule } from '../rule'

const LOW_PERCENT = 15

// `pmset -g batt` prints `-InternalBattery-0 (id=...)	87%; discharging; 4:12 remaining`.
// A desktop Mac has no such line, so there is nothing to show.
export const parseBattery = (stdout: string): Fetched | null => {
  const found = /(\d{1,3})%;\s*([^;\n]*)/.exec(stdout)
  if (found === null) return null
  const percent = Math.min(100, Number(found[1]))
  const state = (found[2] ?? '').trim().toLowerCase()
  if (state === 'discharging') {
    return { text: `🔋 ${percent}%`, ...(percent <= LOW_PERCENT ? { color: 'red' } : {}) }
  }
  const isCharging = state === 'charging' || state === 'finishing charge'
  return { text: `${isCharging ? '⚡' : '🔌'} ${percent}%` }
}

// The battery percent and whether it charges, from macOS's pmset, read at most
// once a minute. Another system has no pmset: the run fails and nothing shows.
export const rule: BandRule = {
  id: 'battery-band',
  fetch: {
    everyMs: 60_000,
    timeoutMs: 5000,
    read: async run => {
      const ran = await run(['pmset', '-g', 'batt'])
      return ran.exitCode === 0 ? parseBattery(ran.stdout) : null
    },
  },
  segment: ({ fetched }) => {
    const found = fetched['battery-band']
    return found === null || found === undefined ? undefined : { key: 'battery-band', ...found }
  },
}
