// Files edited per file type, across sessions (store key `langs`). Kept apart
// from the days, whose shape other mods read whole. Counts only: the type of
// each file, never its path or its contents.

export type Langs = Record<string, number>

export const LANGS = 'langs'

// A store keeps this many types; later new ones count as `(other)`.
const MAX_TYPES = 50
export const NO_EXT = '(none)'
export const OTHER = '(other)'

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

// The file type a path names: what follows the last dot of its name, lower
// case. A name with no dot, or only a leading one (`.gitignore`), has none.
export const extOf = (path: string): string => {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return NO_EXT
  const ext = name.slice(dot + 1).toLowerCase()
  return /^[a-z0-9+_-]{1,10}$/.test(ext) ? ext : OTHER
}

export const readLangs = (raw: unknown): Langs =>
  isRecord(raw) ? Object.fromEntries(Object.entries(raw).map(([ext, n]) => [ext, count(n)])) : {}

// A new tally with one more file for each path's type. Pure.
export const addLangs = (langs: Langs, paths: readonly string[]): Langs =>
  paths.map(extOf).reduce<Langs>((tally, ext) => {
    const key = ext in tally || Object.keys(tally).length < MAX_TYPES ? ext : OTHER
    return { ...tally, [key]: (tally[key] ?? 0) + 1 }
  }, langs)
