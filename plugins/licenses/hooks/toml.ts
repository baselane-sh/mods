// The little of TOML that dependency and script tables use: sections, plain
// `key = value` rows and string arrays. Not a TOML parser.

// Drops a trailing "# comment", leaving a "#" inside quotes alone.
const stripComment = (line: string): string => {
  let quote = ''
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quote !== '') quote = ch === quote ? '' : quote
    else if (ch === '"' || ch === "'") quote = ch
    else if (ch === '#') return line.slice(0, i)
  }
  return line
}

// Body rows (comments dropped) by section name, "" for rows before any header.
// An array-of-tables header ([[bin]]) starts a section nobody asks for.
export const sections = (text: string): Map<string, string[]> => {
  const found = new Map<string, string[]>()
  let current = ''
  for (const raw of text.split('\n')) {
    const row = stripComment(raw).trimEnd()
    const header = /^\s*\[([^\[\]]+)\]\s*$/.exec(row)
    if (header !== null) current = (header[1] ?? '').trim()
    else if (/^\s*\[\[/.test(row)) current = `[[${row.trim()}`
    else if (row.trim() !== '') found.set(current, [...(found.get(current) ?? []), row])
  }
  return found
}

const STRING = /"((?:[^"\\]|\\.)*)"|'([^']*)'/g

// `key = [ "a", "b" ]` across any number of rows. Undefined when absent.
export const stringArray = (body: readonly string[], key: string): string[] | undefined => {
  const text = body.join('\n')
  const start = new RegExp(`^\\s*${key}\\s*=\\s*\\[`, 'm').exec(text)
  if (start === null) return undefined
  let quote = ''
  let end = text.length
  for (let i = start.index + start[0].length; i < text.length; i += 1) {
    const ch = text[i]
    if (quote !== '') quote = ch === quote ? '' : quote
    else if (ch === '"' || ch === "'") quote = ch
    else if (ch === ']') {
      end = i
      break
    }
  }
  const inside = text.slice(start.index + start[0].length, end)
  return [...inside.matchAll(STRING)].map(hit => hit[1] ?? hit[2] ?? '')
}

// One-row `name = value` pairs. A value that goes on over several rows keeps its first row.
export const pairs = (body: readonly string[]): [string, string][] =>
  body.flatMap(row => {
    const hit = /^\s*("[^"]+"|[A-Za-z0-9_.-]+)\s*=\s*(.*?)\s*$/.exec(row)
    return hit === null ? [] : [[(hit[1] ?? '').replace(/^"|"$/g, ''), hit[2] ?? '']]
  })

const unquote = (raw: string): string => raw.replace(/^["']|["']$/g, '')

// The version a dependency value stands for: a string is the version; an inline
// table gives its `version`, else what it points at ("path", "git", "workspace").
export const versionOf = (raw: string): string => {
  if (/^["']/.test(raw)) return unquote(raw)
  const version = /\bversion\s*=\s*["']([^"']*)["']/.exec(raw)
  if (version !== null) return version[1] ?? '*'
  for (const kind of ['workspace', 'path', 'git']) if (new RegExp(`\\b${kind}\\s*=`).test(raw)) return `(${kind})`
  return '*'
}
