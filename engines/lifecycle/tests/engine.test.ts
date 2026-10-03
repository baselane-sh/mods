import { expect, test } from 'claude-code/testing'

import { settingsFrom } from '../hooks/engine'
import { probe } from './probe'

test('lifecycle engine: unset options mean no topic and a 60 second threshold', () => {
  expect(settingsFrom({})).toEqual({ ntfyTopic: '', longRunSecs: 60 })
})

test('lifecycle engine: options are read as given, topic trimmed', () => {
  expect(settingsFrom({ ntfyTopic: '  my-topic ', longRunSecs: 30 })).toEqual({ ntfyTopic: 'my-topic', longRunSecs: 30 })
})

test('lifecycle engine: a bad threshold falls back to 60', () => {
  expect(settingsFrom({ longRunSecs: 0 }).longRunSecs).toBe(60)
  expect(settingsFrom({ longRunSecs: -5 }).longRunSecs).toBe(60)
  expect(settingsFrom({ longRunSecs: 'soon' }).longRunSecs).toBe(60)
})

test('lifecycle engine: an ordinary tool call comes back untouched', async ($, on) => {
  const session = probe($, on)
  const ran = await session.bash('ls')
  expect(ran.context ?? []).toEqual([])
})
