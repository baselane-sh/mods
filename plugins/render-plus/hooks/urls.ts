// Finds http and https URLs in text and keeps the ones a `Link` may carry:
// `https:`, or `http:` on localhost, spelled as `new URL(href).href`, at most
// 2048 characters of printable ASCII, with no user part and no raw `@`. One
// bad href refuses the whole tree, so anything else stays plain text.

const CANDIDATE = /\bhttps?:\/\/[^\s<>"'`]+/g
const TRAILING = /[.,;:!?'"*]+$/
const PRINTABLE = /^[\x21-\x7e]+$/
const MAX_HREF = 2048
// Text past this many characters is not searched.
export const MAX_SCAN = 100_000

const count = (text: string, char: string): number => text.split(char).length - 1

// Sentence punctuation after a URL is not part of it, nor a closing bracket
// the URL never opened (`(see https://a.dev/x)`).
const trim = (raw: string): string => {
  let url = raw.replace(TRAILING, '')
  for (const [open, close] of [['(', ')'], ['[', ']']] as const) {
    while (url.endsWith(close) && count(url, close) > count(url, open)) url = url.slice(0, -1).replace(TRAILING, '')
  }
  return url
}

const isLocal = (hostname: string): boolean => hostname === 'localhost'

// The href a Link may carry for `raw`, or undefined.
export const linkable = (raw: string): string | undefined => {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return undefined
  }
  if (parsed.username !== '' || parsed.password !== '') return undefined
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal(parsed.hostname))) return undefined
  const href = parsed.href.replaceAll('@', '%40')
  if (href.length > MAX_HREF || !PRINTABLE.test(href)) return undefined
  try {
    return new URL(href).href === href ? href : undefined
  } catch {
    return undefined
  }
}

// Each linkable URL once, in the order first written.
export const findUrls = (texts: readonly string[]): string[] => {
  const hrefs = texts.flatMap(text => [...text.slice(0, MAX_SCAN).matchAll(CANDIDATE)].map(match => linkable(trim(match[0]))))
  return [...new Set(hrefs.filter((href): href is string => href !== undefined))]
}
