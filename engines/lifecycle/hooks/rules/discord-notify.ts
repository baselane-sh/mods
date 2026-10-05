import type { LifecycleRule } from '../engine'
import { projectName } from '../ntfy'
import { postJson } from '../webhook'

// Posts to a Discord webhook when Claude Code needs input. Only the project
// folder name and a short status leave the machine, with mentions turned off
// so a folder named "@everyone" pings nobody. A no-op until a URL is set.
const PREFIXES = [
  'https://discord.com/api/webhooks/',
  'https://discordapp.com/api/webhooks/',
  'https://canary.discord.com/api/webhooks/',
  'https://ptb.discord.com/api/webhooks/',
]

export const rule: LifecycleRule = {
  id: 'discord-notify',
  onNeedsInput: async (e, tools, settings) => {
    const url = settings.discordWebhookUrl
    if (url === '') return
    if (!PREFIXES.some(prefix => url.startsWith(prefix))) throw new Error(`the webhook URL must start with ${PREFIXES[0]}`)
    await postJson(tools, url, {
      content: `Claude Code needs your input (${projectName(e.cwd)})`,
      allowed_mentions: { parse: [] },
    })
  },
}
