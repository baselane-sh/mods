import type { RenderRule } from '../engine'
import { forgeCache, issueHref } from '../forge'
import { linkTokens, replyMarkdown } from '../marks'
import { MAX_MARKDOWN } from '../refs'

// `#123` in a reply becomes a link to that issue of the repository's GitHub
// or GitLab origin (GitHub sends a pull request's number on to the pull
// request). Display only; with no known origin the reply stays plain.

// Not after a word (`repo#9`), a slash, `&` (`&#123;`), `#` or `-`; not
// followed by a word or `-`. Up to seven digits, never #0.
const ISSUE = String.raw`(?<![\w/&#-])#[1-9]\d{0,6}(?![\w-])`
const ISSUE_GLOBAL = new RegExp(ISSUE, 'g')
const KEY = 'issue-links'

// Each reference once, in the order first written, outside code and links.
export const findIssues = (text: string): string[] => {
  const seen = new Set<string>()
  linkTokens(text, ISSUE_GLOBAL, found => {
    seen.add(found)
    return undefined
  })
  return [...seen]
}

export const create = (): RenderRule => {
  const forgeFor = forgeCache()

  return {
    id: 'issue-links',
    assistantText: {
      draw: async ({ e, elements, cwd, repo }) => {
        if (findIssues(e.props.text).length === 0) return undefined
        const forge = await forgeFor(await cwd(), repo)
        if (forge === undefined) return undefined
        const text = linkTokens(e.props.text, ISSUE_GLOBAL, found => issueHref(forge, found.slice(1)))
        if (text === e.props.text || text.length > MAX_MARKDOWN) return undefined
        return replyMarkdown(elements, KEY, text, e.surface === 'terminal' && e.props.isFirstOfReply)
      },
    },
  }
}
