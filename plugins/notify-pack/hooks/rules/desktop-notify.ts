import type { LifecycleRule } from '../engine'
import { TITLE, hasProgram, isMac, mustRun, needsInputText } from '../notify'

// A desktop notification when Claude Code needs input. The text travels as
// argv elements after `--`, never inside the AppleScript source, so a folder
// name cannot inject script. Elsewhere notify-send when installed, else
// nothing.
const APPLESCRIPT = ['-e', 'on run argv', '-e', 'display notification (item 1 of argv) with title (item 2 of argv)', '-e', 'end run']

export const rule: LifecycleRule = {
  id: 'desktop-notify',
  onNeedsInput: async (e, tools) => {
    const text = needsInputText(e.cwd)
    if (await isMac(tools)) return mustRun(tools, ['osascript', ...APPLESCRIPT, '--', text, TITLE])
    if (await hasProgram(tools, 'notify-send')) return mustRun(tools, ['notify-send', '--', TITLE, text])
  },
}
