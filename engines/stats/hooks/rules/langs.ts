import { LANGS, NO_EXT, OTHER, readLangs } from '../exts'
import type { StatsRule, View } from '../rule'

// Which file types Claude edited most, across sessions, as a bar list. The
// engine keeps the tally (`langs: true`); a file counts once per session.
const SHOWN = 10
const BAR = 20
const LABEL_WIDTH = 8
const NAME_WIDTH = 13

const NAMES: Readonly<Record<string, string>> = {
  ts: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  jsx: 'JSX',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  swift: 'Swift',
  rb: 'Ruby',
  php: 'PHP',
  cs: 'C#',
  c: 'C',
  h: 'C header',
  cpp: 'C++',
  md: 'Markdown',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sh: 'Shell',
  sql: 'SQL',
  ipynb: 'Notebook',
}

const isSpecial = (ext: string): boolean => ext === NO_EXT || ext === OTHER

const labelOf = (ext: string): string => (isSpecial(ext) ? ext : `.${ext}`)

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

// Most files first; on a tie, real types before `(none)` and `(other)`, then by name.
const order = ([a, x]: readonly [string, number], [b, y]: readonly [string, number]): number =>
  y - x || Number(isSpecial(a)) - Number(isSpecial(b)) || a.localeCompare(b)

const blocks = (n: number, most: number): number => (most <= 0 || n <= 0 ? 0 : Math.max(1, Math.round((n / most) * BAR)))

const compose = async ({ store }: View): Promise<string> => {
  const ranked = Object.entries(readLangs(await store.get(LANGS)))
    .filter(([, n]) => n > 0)
    .sort(order)
  if (ranked.length === 0) return 'No edited file counted yet. Each file Claude edits or writes counts at the end of a turn.'
  const total = ranked.reduce((sum, [, n]) => sum + n, 0)
  const shown = ranked.slice(0, SHOWN)
  const rest = ranked.slice(SHOWN)
  const most = shown[0]?.[1] ?? 0
  return [
    `Files Claude edited, by type, across sessions: ${plural(total, 'file')}`,
    ...shown.map(([ext, n]) =>
      `${labelOf(ext).padEnd(LABEL_WIDTH)}${(NAMES[ext] ?? '').padEnd(NAME_WIDTH)}${'█'.repeat(blocks(n, most)).padEnd(BAR)}  ${n}`,
    ),
    ...(rest.length === 0 ? [] : [`+ ${plural(rest.length, 'more type')}, ${plural(rest.reduce((sum, [, n]) => sum + n, 0), 'file')}`]),
    '',
    'A file counts once in each session that edits it.',
  ].join('\n')
}

export const rule: StatsRule = {
  id: 'langs',
  langs: true,
  command: { name: 'langs', description: 'Show which file types Claude edited most across sessions, as bars', copy: false, compose },
}
