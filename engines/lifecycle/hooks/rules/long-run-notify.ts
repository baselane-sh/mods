import type { LifecycleRule } from '../engine'
import { ntfyPush, projectName } from '../ntfy'

// Phone push when a Bash command ran for at least the threshold. Sends the
// project directory name and the whole seconds, never the command. A no-op
// until a topic is set.
export const rule: LifecycleRule = {
  id: 'long-run-notify',
  afterTool: async ({ e, elapsedMs }, tools, settings) => {
    const seconds = Math.floor(elapsedMs / 1000)
    if (e.tool !== 'Bash' || settings.ntfyTopic === '' || seconds < settings.longRunSecs) return undefined
    await ntfyPush(tools, settings.ntfyTopic, `Long command finished (${projectName(await tools.cwd())}, ${seconds}s)`)
    return undefined
  },
}
