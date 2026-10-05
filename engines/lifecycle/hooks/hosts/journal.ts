import type { On, PluginOptions } from 'claude-code'

import { sessionEnd, settingsFrom } from '../engine'
import type { JournalTools, LifecycleRule } from '../engine'

// As the session ends, for rules that keep a journal file in the home folder.
export const sessionEndWithJournal = (on: On, rules: readonly LifecycleRule[], options: PluginOptions): void => {
  const settings = settingsFrom(options)
  on('classic.SessionEnd', async ($, e, next) => {
    const tools: JournalTools = {
      home: () => $.env.get('HOME'),
      now: () => $.clock.now(),
      exists: path => $.fs.exists(path),
      read: path => $.fs.read(path),
      write: (path, text) => $.fs.write(path, text),
    }
    await sessionEnd(rules, settings, tools, text => $.ui.log(text), e)
    return next(e)
  })
}
