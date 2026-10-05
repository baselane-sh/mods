import type { LifecycleRule } from '../engine'
import { projectName } from '../ntfy'
import { postJson } from '../webhook'

// Posts to a Slack incoming webhook when Claude Code needs input. Only the
// project folder name and a short status leave the machine. A no-op until a
// webhook URL is set.
const PREFIX = 'https://hooks.slack.com/'

// Slack reads <...> as links and mentions (<!channel>): escape as its docs say.
const escape = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export const rule: LifecycleRule = {
  id: 'slack-notify',
  onNeedsInput: async (e, tools, settings) => {
    const url = settings.slackWebhookUrl
    if (url === '') return
    if (!url.startsWith(PREFIX)) throw new Error(`the webhook URL must start with ${PREFIX}`)
    await postJson(tools, url, { text: `Claude Code needs your input (${escape(projectName(e.cwd))})` })
  },
}
