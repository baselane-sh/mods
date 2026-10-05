import type { LifecycleRule } from '../engine'
import { isMac, mustRun } from '../notify'

// On macOS, says a fixed line when a main-loop turn ran longer than 30
// seconds. An interrupted turn stays quiet: the person is already there.
const MIN_MS = 30_000
const LINE = 'Claude is done'

export const rule: LifecycleRule = {
  id: 'say-done',
  onTurnEnd: async (e, tools) => {
    if (e.isAborted || e.durationMs <= MIN_MS || !(await isMac(tools))) return
    await mustRun(tools, ['say', LINE])
  },
}
