import type { BoxProps, ElementConstructor, RenderElement, TextProps } from 'claude-code'

import type { Segment } from './rule'

// The two elements the band draws with, from `$.ui.resolve(e)`. Both
// surfaces it targets hand them out; `$` itself never comes here.
export type BandElements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
}

const GAP = '  '

// The segments that fit `columns`, in order. A segment that does not fit is
// dropped whole, with every one after it: a cut figure ("$1.") misleads.
export const fitSegments = (segments: readonly Segment[], columns: number): Segment[] => {
  const fitted: Segment[] = []
  let used = 0
  for (const segment of segments) {
    const width = used === 0 ? segment.text.length : GAP.length + segment.text.length
    if (used + width > columns) break
    fitted.push(segment)
    used += width
  }
  return fitted
}

export const bandTree = ({ Box, Text }: BandElements, segments: readonly Segment[]): RenderElement => (
  <Box key="band" flexDirection="row">
    {segments.flatMap((segment, index) => [
      ...(index === 0
        ? []
        : [
            <Box key={`gap-${index}`}>
              <Text>{GAP}</Text>
            </Box>,
          ]),
      <Box key={segment.key}>
        <Text {...(segment.color === undefined ? {} : { color: segment.color })}>{segment.text}</Text>
      </Box>,
    ])}
  </Box>
)
