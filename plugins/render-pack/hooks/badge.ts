import type { ElementTable, RenderElement } from 'claude-code'

export type BadgeStyle = { color?: string; dimColor?: boolean }

// The engine's row stays whole; a Text may not hold it, so the badge is its
// sibling in a row Box, keyed by the rule that drew it.
export const beside = (
  { Box, Text }: ElementTable,
  row: RenderElement,
  key: string,
  text: string,
  style: BadgeStyle,
): RenderElement =>
  h(Box, { flexDirection: 'row' }, row, ' ', h(Box, { key, flexShrink: 0 }, h(Text, style, text))) as RenderElement

// `2.4s` under a minute (tenths), `1m 5s` from a minute on.
export const formatDuration = (ms: number): string => {
  const tenths = Math.round(ms / 100)
  if (tenths < 600) return `${(tenths / 10).toFixed(1)}s`
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

const UNITS = ['KB', 'MB', 'GB'] as const

// `512 B`, then one decimal under 10 of a unit (`4.2 KB`), whole above it.
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`
}

// One trailing newline ends the last line; it does not start another.
export const countLines = (text: string): number => (text === '' ? 0 : text.replace(/\n$/, '').split('\n').length)

export const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`
