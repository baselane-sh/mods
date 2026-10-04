import { beside, countLines, formatBytes, plural } from '../badge'
import type { RenderRule } from '../engine'
import { isRecord } from '../output'

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

// From Read's stored record: lines for text, bytes for images and PDFs.
const readSize = (output: Record<string, unknown>): string | undefined => {
  const { type, file } = output
  if (!isRecord(file)) return undefined
  if (type === 'text') {
    const { numLines, totalLines } = file
    if (!isCount(numLines) || !isCount(totalLines)) return undefined
    return numLines < totalLines ? `${numLines} of ${plural(totalLines, 'line')}` : plural(totalLines, 'line')
  }
  if (type === 'image' || type === 'pdf' || type === 'parts') {
    return isCount(file.originalSize) ? formatBytes(file.originalSize) : undefined
  }
  return undefined
}

// From Write's stored record, which holds what was written (the person's
// edit in the dialog included); a staged write changed nothing.
const writeSize = (output: Record<string, unknown>): string | undefined => {
  if (output.staged === true || typeof output.content !== 'string') return undefined
  return plural(countLines(output.content), 'line')
}

export const create = (): RenderRule => ({
  id: 'size-badge',
  toolRow: {
    tools: ['Read', 'Write'],
    draw: ({ e, row, elements }) => {
      const { tool, output, isRunning, isErrored, isInterrupted } = e.props
      if (isRunning || isErrored || isInterrupted || !isRecord(output)) return undefined
      const size = tool === 'Read' ? readSize(output) : writeSize(output)
      return size === undefined ? undefined : beside(elements, row, 'size-badge', size, { dimColor: true })
    },
  },
})
