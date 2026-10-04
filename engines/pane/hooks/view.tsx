import type { BoxProps, ElementConstructor, RenderElement, TextProps } from 'claude-code'

import type { PaneCell, PaneView } from '../types'
import { fitCells, timeOfDay } from './lines'
import type { PaneSpec } from './rule'

// The two elements a pane draws with. Both surfaces it targets hand out
// these constructors from `$.ui.resolve(e)`; `$` itself never comes here.
export type PaneElements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
}

const cellText = (Text: PaneElements['Text'], cell: PaneCell): RenderElement => (
  <Text
    {...(cell.color === undefined ? {} : { color: cell.color })}
    {...(cell.bold === true ? { bold: true } : {})}
    {...(cell.dim === true ? { dimColor: true } : {})}
  >
    {cell.text}
  </Text>
)

const rule = (columns: number): string => '─'.repeat(Math.max(0, columns))

// The title and when the lines were read, a rule, then the lines, each cut
// to `columns`. The rule's lines come newest first already.
export const paneTree = (
  { Box, Text }: PaneElements,
  spec: PaneSpec,
  view: PaneView | undefined,
  columns: number,
): RenderElement => {
  const header = fitCells(
    [{ text: spec.title, bold: true }, ...(view === undefined ? [] : [{ text: `  updated ${timeOfDay(view.at)}`, dim: true }])],
    columns,
  )
  return (
    <Box flexDirection="column">
      <Box key="header" flexDirection="row">
        {header.map(cell => cellText(Text, cell))}
      </Box>
      <Text dimColor>{rule(columns)}</Text>
      {view === undefined && (
        <Box key="empty">
          <Text dimColor>{spec.empty}</Text>
        </Box>
      )}
      {(view?.lines ?? []).map(each => (
        <Box key={`line-${each.key}`} flexDirection="row">
          {each.isRule === true ? <Text dimColor>{rule(columns)}</Text> : fitCells(each.cells, columns).map(cell => cellText(Text, cell))}
        </Box>
      ))}
    </Box>
  )
}
