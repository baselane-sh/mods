import type { On, PluginOptions } from 'claude-code'

import { afterTool, NO_TOOL_TOOLS, push, RUN_TIMEOUT_MS, settingsFrom } from '../engine'
import type { LifecycleRule, ToolTools } from '../engine'

// After a tool call, for rules that read files, run programs and read the project root (a linter).
export const afterToolWithFilesAndRoot = (on: On, rules: readonly LifecycleRule[], options: PluginOptions): void => {
  const settings = settingsFrom(options)
  on('tool.call', async ($, e, next) => {
    const tools: ToolTools = {
      ...NO_TOOL_TOOLS,
      cwd: () => $.session.cwd(),
      exists: path => $.fs.exists(path),
      read: path => $.fs.read(path),
      list: async path => (await $.fs.list(path)).map(entry => entry.name),
      run: (argv, cwd) => $.process.run(argv, cwd === undefined ? { timeoutMs: RUN_TIMEOUT_MS } : { cwd, timeoutMs: RUN_TIMEOUT_MS }),
      root: () => $.session.root(),
    }
    return afterTool(rules, settings, tools, { now: () => $.clock.now(), log: text => $.ui.log(text) }, e, next)
  })
}
