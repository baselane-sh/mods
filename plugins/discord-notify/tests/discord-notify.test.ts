import { expect, test } from 'claude-code/testing'

import { postJson } from '../hooks/webhook'
import { probe } from './probe'

const HOOK = 'https://discord.com/api/webhooks/123/tok-abc'
const OLD_HOOK = 'https://discordapp.com/api/webhooks/123/tok-abc'
const BODY = '{"content":"Claude Code needs your input (myproj)","allowed_mentions":{"parse":[]}}'

test('discord-notify: posts a short JSON message with mentions turned off', { options: { discordWebhookUrl: HOOK } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput('/work/myproj')
  expect(session.fetched()).toEqual([{ url: HOOK, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: BODY }])
})

test('discord-notify: the discordapp.com host is accepted too', { options: { discordWebhookUrl: OLD_HOOK } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput('/work/myproj')
  expect(session.fetched()[0]?.url).toBe(OLD_HOOK)
})

test('discord-notify: no webhook URL, no post', async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()).toEqual([])
  expect(session.logs()).toEqual([])
})

test('discord-notify: a URL that is not a Discord webhook is refused without naming it', { options: { discordWebhookUrl: 'https://discord.com/channels/1/2' } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()).toEqual([])
  expect(session.logs()).toEqual(['discord-notify: skipped, the webhook URL must start with https://discord.com/api/webhooks/'])
})

test('discord-notify: a lookalike host is refused', { options: { discordWebhookUrl: 'https://discord.com.evil.example/api/webhooks/1/2' } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()).toEqual([])
})

test('discord-notify: the text never carries the notification message', { options: { discordWebhookUrl: HOOK } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()[0]?.body).not.toContain('permission to use Bash')
})

test('discord-notify: a failed post never names the webhook URL', async () => {
  const tools = { post: () => Promise.reject(new Error(`bad gateway at ${HOOK}`)) }
  await expect(postJson(tools, HOOK, { content: 'x' })).rejects.toThrow('bad gateway at [webhook URL]')
  await expect(postJson(tools, HOOK, { content: 'x' })).rejects.not.toThrow('tok-abc')
})

test('discord-notify: a refused post is logged and the notification goes on', { options: { discordWebhookUrl: HOOK } }, async ($, on) => {
  const session = probe($, on, { ntfyStatus: 500 })
  await session.needsInput()
  expect(session.logs()).toEqual(['discord-notify: skipped, the push was refused (HTTP 500)'])
})
