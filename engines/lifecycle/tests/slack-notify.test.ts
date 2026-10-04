import { expect, test } from 'claude-code/testing'

import { postJson } from '../hooks/webhook'
import { probe } from './probe'

// Spliced so this file does not match the secret shape it carries.
const HOOK = 'https://hooks.slack.com/services/' + 'T000/B000/abc123'

test('slack-notify: posts a short JSON text to the webhook', { options: { slackWebhookUrl: HOOK } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput('/work/myproj')
  expect(session.fetched()).toEqual([
    { url: HOOK, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"text":"Claude Code needs your input (myproj)"}' },
  ])
})

test('slack-notify: no webhook URL, no post', async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()).toEqual([])
  expect(session.logs()).toEqual([])
})

test('slack-notify: a URL that is not a Slack webhook is refused without naming it', { options: { slackWebhookUrl: 'https://evil.example/hooks.slack.com/x' } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()).toEqual([])
  expect(session.logs()).toEqual(['slack-notify: skipped, the webhook URL must start with https://hooks.slack.com/'])
})

test('slack-notify: a lookalike host is refused', { options: { slackWebhookUrl: 'https://hooks.slack.com.evil.example/x' } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()).toEqual([])
})

test('slack-notify: plain http is refused', { options: { slackWebhookUrl: 'http://hooks.slack.com/services/x' } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()).toEqual([])
})

test('slack-notify: the text never carries the notification message', { options: { slackWebhookUrl: HOOK } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()[0]?.body).not.toContain('permission to use Bash')
})

test('slack-notify: Slack control characters in the folder name are escaped', { options: { slackWebhookUrl: HOOK } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput('/work/<!channel> & co')
  expect(session.fetched()[0]?.body).toBe('{"text":"Claude Code needs your input (&lt;!channel&gt; &amp; co)"}')
})

// The engine logs a rule's error, so an error that quotes the URL is scrubbed.
test('slack-notify: a failed post never names the webhook URL', async () => {
  const tools = { post: () => Promise.reject(new Error(`connect failed for ${HOOK}`)) }
  await expect(postJson(tools, HOOK, { text: 'x' })).rejects.toThrow('connect failed for [webhook URL]')
  await expect(postJson(tools, HOOK, { text: 'x' })).rejects.not.toThrow('abc123')
})

test('slack-notify: a refused post does not break the notification', { options: { slackWebhookUrl: HOOK } }, async ($, on) => {
  const session = probe($, on, { ntfyStatus: 404 })
  await session.needsInput()
  expect(session.fetched().length).toBe(1)
  expect(session.logs()).toEqual(['slack-notify: skipped, the push was refused (HTTP 404)'])
})
