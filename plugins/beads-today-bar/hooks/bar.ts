// A bar of `cells` cells for `part` of `whole`. The cells round, but the bar
// reads full only when the part is whole, so 96 of 100 never looks done.
export const cellsOf = (part: number, whole: number, cells: number): number => {
  if (whole <= 0 || part <= 0) return 0
  if (part >= whole) return cells
  return Math.min(cells - 1, Math.round((part * cells) / whole))
}

export const bar = (filled: number, cells: number, full = '█', empty = '░'): string =>
  `${full.repeat(filled)}${empty.repeat(cells - filled)}`
