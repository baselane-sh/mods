import { beside, formatDuration } from '../badge'
import type { RenderRule } from '../engine'

// A call this quick, or quicker, needs no badge.
const MIN_MS = 1000

export const create = (): RenderRule => ({
  id: 'time-badge',
  toolRow: {
    tools: 'all',
    timed: true,
    draw: ({ e, row, elements, durationMs }) => {
      if (e.props.isRunning || durationMs === undefined || durationMs <= MIN_MS) return undefined
      return beside(elements, row, 'time-badge', formatDuration(durationMs), { dimColor: true })
    },
  },
})
