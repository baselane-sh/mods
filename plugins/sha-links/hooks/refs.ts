// Finds `path/to/file.ts:42` references in markdown and writes them as links.
// Fenced code, existing links and autolinks are left as written; a code span
// that is exactly one reference becomes the link's text.

// A Markdown element's text is at most this many characters.
export const MAX_MARKDOWN = 10_000

// A path with an extension, optionally `./`, `../` or `/` first; then
// `:line`, optionally `:column`.
const PATH = String.raw`(?:\.{1,2}\/|\/)?(?:[\w.-]+\/)*[\w-][\w.-]*\.[A-Za-z]\w*`
const REF = String.raw`(${PATH}):\d+(?::\d+)?`

// Not inside a word, a URL (`host:port`, `/a.ts:4` after a host) or a version.
const BARE = new RegExp(String.raw`(?<![\w./:@~-])${REF}(?![\w/])`, 'g')
const WHOLE = new RegExp(String.raw`^${REF}$`)
const PROTECTED = /(`+)[^`]*?\1|\[[^\]]*\]\([^)]*\)|<[^>\s]+>/g
const FENCE = /^\s*(```|~~~)/

// Calls `link` with each reference's path as written; a string answer
// replaces the reference with that link target, undefined leaves it.
const mapRefs = (text: string, link: (path: string) => string | undefined): string => {
  let isFenced = false
  return text
    .split('\n')
    .map(line => {
      if (FENCE.test(line)) {
        isFenced = !isFenced
        return line
      }
      if (isFenced) return line
      const plain = (part: string): string =>
        part.replace(BARE, (found: string, path: string) => {
          const href = link(path)
          return href === undefined ? found : `[${found}](${href})`
        })
      let out = ''
      let from = 0
      for (const match of line.matchAll(PROTECTED)) {
        const at = match.index ?? 0
        const segment = match[0]
        out += plain(line.slice(from, at))
        const fence = match[1]
        const inner = fence === undefined ? undefined : segment.slice(fence.length, segment.length - fence.length).trim()
        const whole = inner === undefined ? null : WHOLE.exec(inner)
        const href = whole?.[1] === undefined ? undefined : link(whole[1])
        out += href === undefined ? segment : `[${segment}](${href})`
        from = at + segment.length
      }
      return out + plain(line.slice(from))
    })
    .join('\n')
}

// Each referenced path once, in the order first written.
export const findRefs = (text: string): string[] => {
  const seen = new Set<string>()
  mapRefs(text, path => {
    seen.add(path)
    return undefined
  })
  return [...seen]
}

export const linkRefs = (text: string, hrefOf: (path: string) => string | undefined): string => mapRefs(text, hrefOf)

// The path relative to `cwd` when it lands inside it (`.` and `..` folded,
// no file system call), else undefined.
export const insideOf = (cwd: string, path: string): string | undefined => {
  const base = cwd.replace(/\/+$/, '')
  const full = path.startsWith('/') ? path : `${base}/${path}`
  const parts: string[] = []
  for (const part of full.split('/')) {
    if (part === '' || part === '.') continue
    if (part !== '..') parts.push(part)
    else if (parts.pop() === undefined) return undefined
  }
  const resolved = parts.join('/')
  const root = base.split('/').filter(part => part !== '' && part !== '.').join('/')
  if (root === '') return resolved === '' ? undefined : resolved
  return resolved.startsWith(`${root}/`) ? resolved.slice(root.length + 1) : undefined
}
