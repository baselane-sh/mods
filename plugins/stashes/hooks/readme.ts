// Parsing a README: its headings and its relative links. Pure.

export const SECTIONS: readonly (readonly [label: string, heading: RegExp])[] = [
  ['install', /install|setup|set up|getting started/i],
  ['usage', /usage|quick ?start|example|how to use|getting started/i],
  ['licence', /licen[cs]e/i],
  ['contributing', /contribut/i],
]

type Line = { number: number; text: string }

// Lines outside code fences, numbered from 1.
const prose = (text: string): Line[] => {
  let fenced = false
  const kept: Line[] = []
  text.split(/\r?\n/).forEach((row, i) => {
    if (/^\s*(```|~~~)/.test(row)) fenced = !fenced
    else if (!fenced) kept.push({ number: i + 1, text: row })
  })
  return kept
}

// "# Title" lines, and a text line over a ===== or ----- underline.
export const headings = (text: string): string[] => {
  const rows = prose(text)
  return rows.flatMap((row, i) => {
    const atx = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(row.text)
    if (atx !== null) return [atx[1] ?? '']
    const under = rows[i + 1]?.text ?? ''
    return row.text.trim() !== '' && /^(=+|-+)\s*$/.test(under) && !/^(=+|-+)\s*$/.test(row.text) ? [row.text.trim()] : []
  })
}

export type Link = { line: number; target: string }

// [text](target) and ![alt](target). The target is cut at a space (a title).
const LINK = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^)]*["'])?\s*\)/g

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i

// The file part of each relative link: no scheme, anchor, query or absolute path.
export const relativeLinks = (text: string): Link[] =>
  prose(text).flatMap(row =>
    [...row.text.matchAll(LINK)].flatMap(hit => {
      const raw = hit[1] ?? ''
      if (EXTERNAL.test(raw)) return []
      const target = raw.split('#')[0]?.split('?')[0] ?? ''
      return target === '' ? [] : [{ line: row.number, target }]
    }),
  )

// `base` is the README's folder under the repo root, '' for the root. The
// answer is the repo-relative path, or undefined when the link climbs out of the repo.
export const resolveLink = (base: string, target: string): string | undefined => {
  let decoded = target
  try {
    decoded = decodeURIComponent(target)
  } catch {
    // A stray % stays as typed.
  }
  const parts: string[] = base === '' ? [] : base.split('/')
  for (const part of decoded.split('/')) {
    if (part === '..') {
      if (parts.length === 0) return undefined
      parts.pop()
    } else if (part !== '.' && part !== '') parts.push(part)
  }
  return parts.join('/')
}
