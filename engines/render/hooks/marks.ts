import type { ElementTable, RenderElement } from 'claude-code'

// Turns tokens in a reply's markdown into links. Fenced code, existing links,
// autolinks and bare URLs are left as written; a code span that is exactly
// one token becomes the link's text.

const PROTECTED = /(`+)[^`]*?\1|\[[^\]]*\]\([^)]*\)|<[^>\s]+>|https?:\/\/\S+/g
const FENCE = /^\s*(```|~~~)/

// `token` must be a global pattern matching the token alone (boundaries as
// lookarounds); `hrefOf` answers a link target or undefined to leave it.
export const linkTokens = (text: string, token: RegExp, hrefOf: (found: string) => string | undefined): string => {
  const whole = new RegExp(`^(?:${token.source})$`)
  const plain = (part: string): string =>
    part.replace(token, (found: string) => {
      const href = hrefOf(found)
      return href === undefined ? found : `[${found}](${href})`
    })
  let isFenced = false
  return text
    .split('\n')
    .map(line => {
      if (FENCE.test(line)) {
        isFenced = !isFenced
        return line
      }
      if (isFenced) return line
      let out = ''
      let from = 0
      for (const match of line.matchAll(PROTECTED)) {
        const at = match.index ?? 0
        const segment = match[0]
        out += plain(line.slice(from, at))
        const fence = match[1]
        const inner = fence === undefined ? undefined : segment.slice(fence.length, segment.length - fence.length).trim()
        const href = inner !== undefined && whole.test(inner) ? hrefOf(inner) : undefined
        out += href === undefined ? segment : `[${segment}](${href})`
        from = at + segment.length
      }
      return out + plain(line.slice(from))
    })
    .join('\n')
}

// A reply's text block redrawn as markdown, keyed by the rule that drew it.
// The block that opens a reply draws its bullet; drawing the block ourselves,
// the terminal's bullet is ours to draw.
export const replyMarkdown = (
  { Box, Text, Markdown }: ElementTable,
  key: string,
  text: string,
  bullet: boolean,
): RenderElement => {
  const markdown = h(Markdown, { key, text }) as RenderElement
  if (!bullet) return markdown
  return h(Box, { flexDirection: 'row' }, h(Text, null, '⏺ '), h(Box, { flexDirection: 'column', flexGrow: 1 }, markdown)) as RenderElement
}
