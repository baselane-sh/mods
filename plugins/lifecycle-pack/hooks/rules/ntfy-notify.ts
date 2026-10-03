import type { LifecycleRule } from '../engine'
import { ntfyPush, projectName } from '../ntfy'

// Phone push when Claude Code needs input. Generic message only: no prompt or
// command text leaves the machine. A no-op until a topic is set.
export const rule: LifecycleRule = {
  id: 'ntfy-notify',
  onNeedsInput: async (e, tools, settings) => {
    if (settings.ntfyTopic === '') return
    await ntfyPush(tools, settings.ntfyTopic, `Needs your input (${projectName(e.cwd)})`)
  },
}
