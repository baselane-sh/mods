import type { Fetched } from '../../types'
import { IN_PROGRESS, bdJson, cutTitle, latestFirst } from '../beads'
import type { BandRule } from '../rule'

// The bead in progress that was updated last, and how many more are in progress.
export const nowLine = (list: unknown): Fetched | null => {
  const beads = latestFirst(list)
  const [first] = beads ?? []
  if (beads === null || first === undefined) return null
  const more = beads.length - 1
  return { text: `▶ ${first.id} ${cutTitle(first.title)}${more > 0 ? ` +${more}` : ''}`.trimEnd() }
}

// The bead you work on, read with `bd list --status in_progress` every two
// minutes and after each Bash call or edit. Nothing in progress, no bd or no
// beads project: hidden.
export const rule: BandRule = {
  id: 'bead-now',
  fetch: {
    everyMs: 120_000,
    onEdit: true,
    timeoutMs: 10_000,
    read: async run => nowLine(await bdJson(run, IN_PROGRESS)),
  },
  segment: ({ fetched }) => {
    const found = fetched['bead-now']
    return found === null || found === undefined ? undefined : { key: 'bead-now', text: found.text }
  },
}
