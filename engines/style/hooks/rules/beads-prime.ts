import type { StyleRule } from '../engine'

// What `bd prime` prints goes into the system prompt as one section, so it is
// capped: 8 KB of UTF-8, cut on a character boundary.
export const MAX_BYTES = 8 * 1024
const NOTE = '[cut at 8 KB]'
// The line bd prints for hosts that show hook output; not for the model.
const HOST_NOTICE = /^\[bd prime\][^\n]*\n*/

const bytesOf = (codePoint: number): number => (codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4)

export const capBytes = (text: string, max: number): { text: string; isCut: boolean } => {
  let used = 0
  let end = 0
  for (const char of text) {
    used += bytesOf(char.codePointAt(0) ?? 0)
    if (used > max) return { text: text.slice(0, end), isCut: true }
    end += char.length
  }
  return { text, isCut: false }
}

export const rule: StyleRule = {
  id: 'beads-prime',
  section: '',
  // No project, a failed run or empty output: add nothing. A run that
  // rejects (bd is missing, or it timed out) is handled by the host.
  live: async run => {
    const done = await run(['bd', 'prime'])
    const text = done.stdout.replace(HOST_NOTICE, '').trim()
    if (done.exitCode !== 0 || text === '') return undefined
    const capped = capBytes(text, MAX_BYTES)
    return `Beads project context, from \`bd prime\` run once at the start of this session:\n\n${capped.text.trimEnd()}${capped.isCut ? `\n${NOTE}` : ''}`
  },
}
