import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

test('ntfy-notify: pushes a generic message to the topic', { options: { ntfyTopic: 't-123' } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput('/work/myproj')
  expect(session.fetched()).toEqual([
    { url: 'https://ntfy.sh/t-123', method: 'POST', headers: { Title: 'Claude Code' }, body: 'Needs your input (myproj)' },
  ])
})

test('ntfy-notify: no topic, no push', async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()).toEqual([])
})

test('ntfy-notify: the message never carries the notification text', { options: { ntfyTopic: 't-123' } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(JSON.stringify(session.fetched())).not.toContain('permission to use Bash')
})

test('ntfy-notify: a topic with odd characters stays one path segment', { options: { ntfyTopic: 'a b/c' } }, async ($, on) => {
  const session = probe($, on)
  await session.needsInput()
  expect(session.fetched()[0]?.url).toBe('https://ntfy.sh/a%20b%2Fc')
})

test('ntfy-notify: a refused push does not break the notification', { options: { ntfyTopic: 't-123' } }, async ($, on) => {
  const session = probe($, on, { ntfyStatus: 500 })
  await session.needsInput()
  expect(session.fetched().length).toBe(1)
})
