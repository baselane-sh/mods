export type DiffStats = { added: number; removed: number }

// The widest the bar gets, in cells.
export const MAX_BAR = 20

// Above this many cells (old lines times new lines, after the shared head and
// tail are cut) the line diff is skipped and every differing line counts:
// about a million steps, a few milliseconds.
const MAX_DIFF_CELLS = 1_000_000

// One trailing newline ends the last line; it does not start another.
const linesOf = (text: string): string[] => (text === '' ? [] : text.replace(/\n$/, '').split('\n'))

// Length of the longest common subsequence, one row at a time.
const commonLines = (before: readonly string[], after: readonly string[]): number => {
  let previous: number[] = new Array<number>(after.length + 1).fill(0)
  for (const line of before) {
    const row: number[] = [0]
    after.forEach((other, j) => {
      row.push(line === other ? (previous[j] ?? 0) + 1 : Math.max(previous[j + 1] ?? 0, row[j] ?? 0))
    })
    previous = row
  }
  return previous[after.length] ?? 0
}

// Lines added and removed going from `before` to `after`, as a line diff
// counts them.
export const lineDiff = (before: string, after: string): DiffStats => {
  const a = linesOf(before)
  const b = linesOf(after)
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1
  const removedPart = a.slice(head, a.length - tail)
  const addedPart = b.slice(head, b.length - tail)
  const common = removedPart.length * addedPart.length > MAX_DIFF_CELLS ? 0 : commonLines(removedPart, addedPart)
  return { added: addedPart.length - common, removed: removedPart.length - common }
}

// Cells of green and red: one per line up to MAX_BAR, then proportional. A
// side with any lines keeps at least one cell.
export const barCells = ({ added, removed }: DiffStats): { green: number; red: number } => {
  const total = added + removed
  if (total === 0) return { green: 0, red: 0 }
  const cells = Math.min(MAX_BAR, total)
  const share = Math.round((cells * added) / total)
  const green = added > 0 && share === 0 ? 1 : removed > 0 && share === cells ? cells - 1 : share
  return { green, red: cells - green }
}
