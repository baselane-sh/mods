import type { LifecycleRule } from '../engine'

// One line per session end, `YYYY-MM-DD HH:MM | <directory> | <reason>`, in
// ~/.claude/journal.log: raw data for standups and reviews.
const two = (n: number): string => String(n).padStart(2, '0')

export const stamp = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`
}

export const rule: LifecycleRule = {
  id: 'session-journal',
  onSessionEnd: async (e, tools) => {
    const home = await tools.home()
    if (home === undefined || home === '') return
    const file = `${home}/.claude/journal.log`
    const before = (await tools.exists(file)) ? await tools.read(file) : ''
    const line = `${stamp(await tools.now())} | ${e.cwd === '' ? 'unknown' : e.cwd} | ${e.reason}\n`
    await tools.write(file, before + line)
  },
}
