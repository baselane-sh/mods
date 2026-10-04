import type { RenderElement } from 'claude-code'

import type { RenderRule } from '../engine'
import { findRefs, insideOf, linkRefs, MAX_MARKDOWN } from '../refs'

// A Markdown names at most this many pressable links.
const MAX_PRESSABLE = 256
const KEY = 'file-links'
const SCHEME = 'file://'

// The reference's path relative to the project, from a link this rule drew.
const pathOf = (base: string, href: string): string | undefined => {
  if (!href.startsWith(SCHEME)) return undefined
  try {
    return insideOf(base, decodeURI(href.slice(SCHEME.length)))
  } catch {
    return undefined
  }
}

export const create = (): RenderRule => {
  // Whether a file is at each absolute path, asked once per load. A reply is
  // drawn again on every scroll and stream chunk; the answer is the same.
  const isFileAt = new Map<string, Promise<boolean>>()

  return {
    id: 'file-links',
    assistantText: {
      draw: async ({ e, elements, cwd, stat, insert }) => {
        const refs = findRefs(e.props.text)
        if (refs.length === 0) return undefined
        const base = (await cwd()).replace(/\/+$/, '')

        const isFile = (absolute: string): Promise<boolean> => {
          const known = isFileAt.get(absolute)
          if (known !== undefined) return known
          const asked = stat(absolute).then(
            found => found.kind === 'file',
            () => false,
          )
          isFileAt.set(absolute, asked)
          return asked
        }

        const linked = await Promise.all(
          refs.map(async ref => {
            const relative = insideOf(base, ref)
            if (relative === undefined) return undefined
            const absolute = `${base}/${relative}`
            return (await isFile(absolute)) ? ([ref, `${SCHEME}${encodeURI(absolute)}`] as const) : undefined
          }),
        )
        const hrefOf = new Map(linked.filter(entry => entry !== undefined))
        if (hrefOf.size === 0) return undefined

        const text = linkRefs(e.props.text, ref => hrefOf.get(ref))
        if (text.length > MAX_MARKDOWN) return undefined

        const { Box, Text, Markdown } = elements
        const markdown = h(Markdown, {
          key: KEY,
          text,
          pressableLinks: [...new Set(hrefOf.values())].slice(0, MAX_PRESSABLE),
          onLinkPress: (link: { href: string }) => {
            const path = pathOf(base, link.href)
            if (path !== undefined) insert(`@${path} `)
          },
        }) as RenderElement
        // The block that opens a reply draws its bullet; drawing the block
        // ourselves, the terminal's bullet is ours to draw.
        if (e.surface !== 'terminal' || !e.props.isFirstOfReply) return markdown
        return h(Box, { flexDirection: 'row' }, h(Text, null, '⏺ '), h(Box, { flexDirection: 'column', flexGrow: 1 }, markdown)) as RenderElement
      },
    },
  }
}
