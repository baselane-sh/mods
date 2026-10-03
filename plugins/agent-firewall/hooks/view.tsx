import type { BoxProps, ElementConstructor, RenderElement, TextProps } from 'claude-code'

import type { FirewallCounts, FirewallOutcome, FirewallRow } from '../types'

// The two elements the pane draws with. Both surfaces it targets hand out
// these constructors from `$.ui.resolve(e)`; `$` itself never comes here.
export type PaneElements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
}

// The mark carries the outcome in a glyph and a word, so a row reads the
// same without color.
const MARK: Readonly<Record<FirewallOutcome, { text: string; color: string }>> = {
  ran: { text: '✔ ran', color: 'green' },
  asked: { text: '? asked', color: 'cyan' },
  blocked: { text: '✘ blocked', color: 'red' },
  error: { text: '! error', color: 'yellow' },
}

const TIME_WIDTH = 9
const MARK_WIDTH = 10
const TOOL_WIDTH = 13
// Below this width the time column gives its room to the summary.
const TIME_MIN_COLUMNS = 50

const fit = (text: string, width: number): string => {
  if (width <= 0) return ''
  return text.length <= width ? text : `${text.slice(0, width - 1)}…`
}

const column = (text: string, width: number): string => fit(text, width - 1).padEnd(width)

const two = (n: number): string => String(n).padStart(2, '0')

const clock = (at: number): string => {
  const date = new Date(at)
  return `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
}

// The row's cells, each cut so the whole line fits `columns`.
export const rowCells = (row: FirewallRow, columns: number) => {
  const time = columns >= TIME_MIN_COLUMNS ? column(clock(row.at), TIME_WIDTH) : ''
  const mark = fit(column(MARK[row.outcome].text, MARK_WIDTH), columns - time.length)
  const tool = fit(column(row.tool, TOOL_WIDTH), columns - time.length - mark.length)
  const summary = fit(row.summary, columns - time.length - mark.length - tool.length)
  return { time, mark, tool, summary }
}

const COUNTERS: readonly { key: string; field: keyof FirewallCounts; word: string; color?: string }[] = [
  { key: 'count-calls', field: 'calls', word: 'calls' },
  { key: 'count-ran', field: 'ran', word: 'ran', color: 'green' },
  { key: 'count-asked', field: 'asked', word: 'asked', color: 'cyan' },
  { key: 'count-blocked', field: 'blocked', word: 'blocked', color: 'red' },
  { key: 'count-errors', field: 'errors', word: 'errors', color: 'yellow' },
]

export const paneTree = (
  { Box, Text }: PaneElements,
  rows: readonly FirewallRow[],
  counts: FirewallCounts,
  columns: number,
): RenderElement => (
  <Box flexDirection="column">
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      <Text bold>Agent Firewall</Text>
      {COUNTERS.map(counter => (
        <Box key={counter.key}>
          <Text bold {...(counter.color === undefined ? {} : { color: counter.color })}>{`${counts[counter.field]} ${counter.word}`}</Text>
        </Box>
      ))}
    </Box>
    <Text dimColor>{'─'.repeat(Math.max(0, columns))}</Text>
    {rows.length === 0 && (
      <Box key="empty">
        <Text dimColor>No tool calls yet.</Text>
      </Box>
    )}
    {rows.map(row => {
      const cells = rowCells(row, columns)
      return (
        <Box key={`row-${row.id}`} flexDirection="row">
          <Text dimColor>{cells.time}</Text>
          <Text color={MARK[row.outcome].color} bold={row.outcome !== 'ran'}>{cells.mark}</Text>
          <Text bold>{cells.tool}</Text>
          <Text wrap="truncate-end">{cells.summary}</Text>
        </Box>
      )
    })}
  </Box>
)
