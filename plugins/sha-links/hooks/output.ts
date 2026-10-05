// Reads a tool's stored result as the row props carry it (`unknown`).

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

// A failed Bash call stores the text the model read: `Exit code 1` and the
// output, the stored record spelling it `Error: Exit code 1`.
const EXIT = /^(?:Error: )?Exit code (\d+)\b/

const textBlocks = (blocks: readonly unknown[]): string[] =>
  blocks.flatMap(block => (isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? [block.text] : []))

// The texts an output shows: a plain string, a Bash record's stdout and
// stderr, or text blocks. Anything else shows none this module reads.
export const outputTexts = (output: unknown): string[] => {
  if (typeof output === 'string') return [output]
  if (Array.isArray(output)) return textBlocks(output)
  if (!isRecord(output)) return []
  return [output.stdout, output.stderr].filter((text): text is string => typeof text === 'string')
}

// The exit code a failed command's output names, or undefined.
export const exitCodeOf = (output: unknown): number | undefined => {
  const [first] = outputTexts(output)
  const found = first === undefined ? null : EXIT.exec(first.trimStart())
  return found?.[1] === undefined ? undefined : Number(found[1])
}

// Shorter than this, one line of JSON reads well as it is.
export const MIN_JSON = 80
// Longer than this, the parse is not worth a redraw.
const MAX_JSON = 1_000_000
export const FOLD_AT = 30

// One long line of JSON (an object or array), pretty-printed with two
// spaces and folded after FOLD_AT lines; undefined for anything else.
export const prettyJson = (text: string): string | undefined => {
  const line = text.trim()
  if (line.length < MIN_JSON || line.length > MAX_JSON || line.includes('\n')) return undefined
  if (!line.startsWith('{') && !line.startsWith('[')) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  if (!isRecord(parsed)) return undefined
  const lines = JSON.stringify(parsed, null, 2).split('\n')
  if (lines.length <= FOLD_AT) return lines.join('\n')
  const hidden = lines.length - FOLD_AT
  return [...lines.slice(0, FOLD_AT), `... ${hidden} more line${hidden === 1 ? '' : 's'}`].join('\n')
}
