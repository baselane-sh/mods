import type { RenderElement } from 'claude-code'

import { barCells, lineDiff } from '../diff'
import type { DiffStats } from '../diff'
import type { RenderRule } from '../engine'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

// From the call's input as the model sent it. Write's props carry no earlier
// content, so a Write counts as all lines added and none removed.
const statsOf = (tool: string, input: unknown): DiffStats | undefined => {
  if (!isRecord(input)) return undefined
  if (tool === 'Edit') {
    const { old_string: before, new_string: after } = input
    return typeof before === 'string' && typeof after === 'string' ? lineDiff(before, after) : undefined
  }
  if (tool === 'Write') {
    const { content } = input
    return typeof content === 'string' ? lineDiff('', content) : undefined
  }
  return undefined
}

export const create = (): RenderRule => ({
  id: 'diff-stats',
  toolRow: {
    tools: ['Edit', 'Write'],
    draw: ({ e, row, elements: { Box, Text } }) => {
      // A refused, failed or cut call changed nothing worth counting.
      if (e.props.isErrored || e.props.isInterrupted) return undefined
      const stats = statsOf(e.props.tool, e.props.input)
      if (stats === undefined || stats.added + stats.removed === 0) return undefined
      const { green, red } = barCells(stats)
      // The engine's row stays whole; a Text may not hold it, so the bar's
      // Texts are its siblings in a row Box.
      return h(
        Box,
        { flexDirection: 'row' },
        row,
        ' ',
        h(
          Box,
          { key: 'diff-stats', flexDirection: 'row', flexShrink: 0 },
          h(Text, { color: 'green' }, `+${stats.added}`),
          ' ',
          h(Text, { color: 'red' }, `-${stats.removed}`),
          ' ',
          green > 0 ? h(Text, { color: 'green' }, '█'.repeat(green)) : null,
          red > 0 ? h(Text, { color: 'red' }, '█'.repeat(red)) : null,
        ),
      ) as RenderElement
    },
  },
})
