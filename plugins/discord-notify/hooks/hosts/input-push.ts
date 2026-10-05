import type { On, PluginOptions } from 'claude-code'

import { needsInput, NO_NOTIFY_TOOLS, push, settingsFrom } from '../engine'
import type { LifecycleRule, NotifyTools } from '../engine'

// When Claude Code waits for the person, for rules that send a push over the network.
export const needsInputWithPush = (on: On, rules: readonly LifecycleRule[], options: PluginOptions): void => {
  const settings = settingsFrom(options)
  on('classic.Notification', async ($, e, next) => {
    const tools: NotifyTools = {
      ...NO_NOTIFY_TOOLS,
      post: (url, headers, body) =>
        push(
          () => $.http.fetch(url, { method: 'POST', headers, body }),
          ms => $.clock.sleep(ms),
        ),
    }
    await needsInput(rules, settings, tools, text => $.ui.log(text), e)
    return next(e)
  })
}
