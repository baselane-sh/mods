import type { RenderElement } from 'claude-code'

import type { RenderRule } from '../engine'
import { commitHref, forgeCache } from '../forge'
import { linkTokens } from '../marks'
import { outputTexts } from '../output'
import { MAX_MARKDOWN } from '../refs'
import { MAX_SCAN } from '../urls'

// Git commit SHAs become links to the commit page of the repository's
// GitHub or GitLab origin: in replies, and under the row of a Bash call that
// ran git. Display only; with no known origin everything stays plain.

// 7 to 40 lowercase hex digits holding a digit and a letter, not part of a
// longer word, path, URL, number (0x...), color (#...) or file name. A range
// (`a1b2c3d..e4f5a6b`) links both ends.
const SHA = String.raw`(?<![\w/:#@=?&-])(?<!\w\.)(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}(?![\w/-]|\.\w)`
const SHA_GLOBAL = new RegExp(SHA, 'g')
const GIT_COMMAND = /(^|[\s;&|(`])git(\s|$)/
const KEY = 'sha-links'
const MAX_LINKS = 5
const LABEL = 12

// Each SHA once, in the order first written.
export const findShas = (text: string): string[] => [...new Set([...text.slice(0, MAX_SCAN).matchAll(SHA_GLOBAL)].map(match => match[0]))]

const commandOf = (input: unknown): string | undefined =>
  typeof input === 'object' && input !== null && 'command' in input && typeof input.command === 'string' ? input.command : undefined

export const create = (): RenderRule => {
  const forgeFor = forgeCache()

  return {
    id: 'sha-links',
    assistantText: {
      // A rewrite, not a drawing of our own: the text goes on to the rules
      // beneath, so this and another link mod both add their links.
      rewrite: async ({ e, cwd, repo }) => {
        if (findShas(e.props.text).length === 0) return undefined
        const forge = await forgeFor(await cwd(), repo)
        if (forge === undefined) return undefined
        const text = linkTokens(e.props.text, SHA_GLOBAL, sha => commitHref(forge, sha))
        return text === e.props.text || text.length > MAX_MARKDOWN ? undefined : text
      },
    },
    toolRow: {
      tools: ['Bash'],
      draw: async ({ e, row, elements: { Box, Text, Link }, cwd, repo }) => {
        const command = commandOf(e.props.input)
        if (command === undefined || !GIT_COMMAND.test(command) || e.props.output === undefined) return undefined
        const shas = findShas(outputTexts(e.props.output).join('\n'))
        if (shas.length === 0) return undefined
        const forge = await forgeFor(await cwd(), repo)
        if (forge === undefined) return undefined
        const links = shas.flatMap(sha => {
          const href = commitHref(forge, sha)
          return href === undefined ? [] : [{ sha, href }]
        })
        if (links.length === 0) return undefined
        const rest = links.length - MAX_LINKS
        return h(
          Box,
          { flexDirection: 'column' },
          row,
          h(
            Box,
            { key: KEY, flexDirection: 'column' },
            ...links
              .slice(0, MAX_LINKS)
              .map(({ sha, href }) => h(Text, null, h(Text, { dimColor: true }, '  ↗ '), h(Link, { href, label: sha.slice(0, LABEL) }))),
            rest > 0 ? h(Text, { dimColor: true }, `  +${rest} more`) : null,
          ),
        ) as RenderElement
      },
    },
  }
}
