import type { Ran } from './engine'
import { lines } from './helpers'

// One `git grep -n --null` row: the path, the line number and the line text.
// The text is kept only so a rule can classify the row; a rule prints paths
// and line numbers, never the text.
export type Hit = { path: string; line: number; text: string }

// With --null git 2.50 ends the path and the line number with a NUL; a colon
// is accepted too.
const ROW = /^([^\0]+)\0(\d+)[:\0-](.*)$/

export const parseHits = (stdout: string): Hit[] =>
  lines(stdout).flatMap(row => {
    const hit = ROW.exec(row)
    return hit === null ? [] : [{ path: hit[1] ?? '', line: Number(hit[2]), text: hit[3] ?? '' }]
  })

// Line numbers by path, in git's file order, each line once (`-o` prints a
// row per match, so a line with two matches comes twice).
export const byPath = (hits: readonly Hit[]): [string, number[]][] => {
  const found = new Map<string, number[]>()
  for (const { path, line } of hits) {
    const mine = found.get(path)
    if (mine === undefined) found.set(path, [line])
    else if (!mine.includes(line)) mine.push(line)
  }
  return [...found]
}

// git grep answers 0 for a match, 1 for none and more for a failure. A failure
// must never read as "nothing found". Output cut at the cap is a failure too.
export const hitsOf = (ran: Ran): Hit[] => {
  if (ran.timedOut) throw new Error('git grep timed out')
  if (ran.truncated) throw new Error('git grep output passed the 4 MiB cap')
  if (ran.code > 1 || ran.code < 0) throw new Error(`git grep failed (exit ${ran.code})`)
  return parseHits(ran.stdout)
}

const MAX_FILES = 40
const MAX_LINES = 10

// "path  lines 3, 9", with the line list and the file list capped.
export const fileRows = (groups: readonly [string, readonly number[]][]): string[] => [
  ...groups.slice(0, MAX_FILES).map(([path, found]) => {
    const shown = found.slice(0, MAX_LINES).join(', ')
    const rest = found.length > MAX_LINES ? `, +${found.length - MAX_LINES} more` : ''
    return `${path}  line${found.length === 1 ? '' : 's'} ${shown}${rest}`
  }),
  ...(groups.length > MAX_FILES ? [`+${groups.length - MAX_FILES} more files`] : []),
]
