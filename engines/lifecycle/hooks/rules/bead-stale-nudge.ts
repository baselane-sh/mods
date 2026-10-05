import type { LifecycleRule } from '../engine'

export const STALE_DAYS = 7
const LISTED = 5
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

// The ids in `bd stale --json`, or none for anything that is not a list of
// beads. Ids are checked, so a strange id never reaches the toast.
export const staleIds = (stdout: string): readonly string[] => {
  const parsed: unknown = JSON.parse(stdout)
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((item: unknown) => {
    const id = typeof item === 'object' && item !== null && 'id' in item ? item.id : undefined
    return typeof id === 'string' && ID.test(id) ? [id] : []
  })
}

export const toastText = (ids: readonly string[]): string => {
  const shown = ids.slice(0, LISTED).join(', ')
  const more = ids.length > LISTED ? ` and ${ids.length - LISTED} more` : ''
  const subject = ids.length === 1 ? '1 bead in progress has' : `${ids.length} beads in progress have`
  return `${subject} had no update for ${STALE_DAYS} days: ${shown}${more}`
}

// At session start, one toast when beads in progress have had no update for 7
// days. Reads with `bd stale`; without bd, without a beads project or on any
// odd answer it says nothing.
export const rule: LifecycleRule = {
  id: 'bead-stale-nudge',
  onSessionStart: async (e, tools) => {
    const done = await tools
      .run(['bd', 'stale', '--days', String(STALE_DAYS), '--status', 'in_progress', '--limit', '500', '--json'], e.cwd)
      .catch(() => undefined)
    if (done === undefined || done.exitCode !== 0 || done.stdout.trim() === '') return
    let ids: readonly string[]
    try {
      ids = staleIds(done.stdout)
    } catch {
      return
    }
    if (ids.length > 0) await tools.toast(toastText(ids))
  },
}
