import type { On, PluginOptions } from 'claude-code'

import { afterTool, NO_TOOL_TOOLS, push, RUN_TIMEOUT_MS, settingsFrom } from '../engine'
import type { LifecycleRule, ToolTools } from '../engine'

// After a tool call, for rules that send a push over the network.
export const afterToolWithPush = (on: On, rules: readonly LifecycleRule[], options: PluginOptions): void => {
  const settings = settingsFrom(options)
  on('tool.call', async ($, e, next) => {
    const tools: ToolTools = {
      ...NO_TOOL_TOOLS,
      cwd: () => $.session.cwd(),
      post: (url, headers, body) =>
        push(
          () => $.http.fetch(url, { method: 'POST', headers, body }),
          ms => $.clock.sleep(ms),
        ),
    }
    return afterTool(rules, settings, tools, { now: () => $.clock.now(), log: text => $.ui.log(text) }, e, next)
  })
}
