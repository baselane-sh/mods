import type { RenderElement } from 'claude-code'

type Tag = Parameters<typeof h>[0]
export type Parts = { Box: Tag; Text: Tag }

// Draws a command's output row as a bordered box, one Text per line so the
// monospace layout holds on every surface. The engine ends each answer with
// a blank line and a one-line note; the note sits outside the box.
export const draw = ({ Box, Text }: Parts, full: string): RenderElement => {
  const split = full.lastIndexOf('\n\n')
  const body = split < 0 ? full : full.slice(0, split)
  const note = split < 0 ? '' : full.slice(split + 2)

  // h answers a node; two Boxes around Texts always make an element.
  return h(
    Box,
    { flexDirection: 'column' },
    h(
      Box,
      { flexDirection: 'column', borderStyle: 'round', paddingX: 1, alignSelf: 'flex-start' },
      ...body.split('\n').map(line => h(Text, null, line === '' ? ' ' : line)),
    ),
    note === '' ? null : h(Text, { dimColor: true }, note),
  ) as RenderElement
}
