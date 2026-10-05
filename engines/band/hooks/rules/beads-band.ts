import type { Fetched } from '../../types'
import { bdJson, isCount, ranBd, summaryOf } from '../beads'
import type { BandRule } from '../rule'

// `bd status --json` as a line: ready always, active and blocked when above 0.
export const statusLine = (status: unknown): Fetched | null => {
  const summary = summaryOf(status)
  if (summary === null) return null
  const { ready_issues: ready, in_progress_issues: active, blocked_issues: blocked } = summary
  if (!isCount(ready) || !isCount(active) || !isCount(blocked)) return null
  const parts = [`${ready} ready`, ...(active > 0 ? [`${active} active`] : []), ...(blocked > 0 ? [`${blocked} blocked`] : [])]
  return { text: `bd ${parts.join(' · ')}` }
}

// The beads project's ready, in progress and blocked counts, read with
// `bd status` every two minutes and after a Bash call that ran bd. No bd or no
// beads project: hidden.
export const rule: BandRule = {
  id: 'beads-band',
  fetch: {
    everyMs: 120_000,
    onEdit: true,
    onEditWhen: ranBd,
    timeoutMs: 10_000,
    read: async (run, _git, now, generation) => statusLine(await bdJson(run, ['status'], { now, generation })),
  },
  segment: ({ fetched }) => {
    const found = fetched['beads-band']
    return found === null || found === undefined ? undefined : { key: 'beads-band', text: found.text }
  },
}
