import type { BandRule } from '../rule'

const CELLS = 10
const YELLOW_FROM = 60
const RED_FROM = 80

// The color is a second cue: the number says the same without it.
const colorOf = (percent: number): string | undefined =>
  percent >= RED_FROM ? 'red' : percent >= YELLOW_FROM ? 'yellow' : undefined

// Context used as a 10 cell bar and a percent. A cell fills per whole ten
// percent, so the bar reads full only at 100.
export const rule: BandRule = {
  id: 'context-meter',
  segment: ({ reading }) => {
    if (reading.percent === undefined) return undefined
    const whole = Math.round(reading.percent)
    const filled = Math.min(CELLS, Math.floor(whole / 10))
    const color = colorOf(whole)
    return {
      key: 'context-meter',
      text: `[${'#'.repeat(filled)}${'-'.repeat(CELLS - filled)}] ${whole}%`,
      ...(color === undefined ? {} : { color }),
    }
  },
}
