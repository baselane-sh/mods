import type { RenderElement } from 'claude-code'

import type { RenderRule } from '../engine'
import { outputTexts } from '../output'
import { findUrls } from '../urls'

// Links listed under one result, at most; the rest are counted.
const MAX_LINKS = 5
const KEY = 'url-links'

export const create = (): RenderRule => ({
  id: 'url-links',
  toolResult: {
    tools: 'all',
    // The engine's result stays whole, fold included; the links are listed
    // under it, so a URL the fold hides is still one click away.
    draw: ({ e, row, elements: { Box, Text, Link } }) => {
      const hrefs = findUrls(outputTexts(e.props.output))
      if (hrefs.length === 0) return undefined
      const rest = hrefs.length - MAX_LINKS
      return h(
        Box,
        { flexDirection: 'column' },
        row,
        h(
          Box,
          { key: KEY, flexDirection: 'column' },
          ...hrefs.slice(0, MAX_LINKS).map(href => h(Text, null, h(Text, { dimColor: true }, '  ↗ '), h(Link, { href }))),
          rest > 0 ? h(Text, { dimColor: true }, `  +${rest} more`) : null,
        ),
      ) as RenderElement
    },
  },
})
