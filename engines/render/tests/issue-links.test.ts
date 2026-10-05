import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { findIssues } from '../hooks/rules/issue-links'
import { assistant, drawnText, ENGINE_KEY, mountAssistant, repository, rootProps, standIn, SURFACES } from './probe'

const KEY = 'issue-links'
const GITHUB = 'https://github.com/baselane/mods.git'
const ISSUES = 'https://github.com/baselane/mods/issues'

test('issue-links: findIssues keeps #N references, not anchors, entities, other repos or code', () => {
  const text = [
    'Fixes #12 and (#7), see #12 again; #3456789.',
    'Not: &#123; owner/repo#9 a#5 #0 #12345678 #42abc #1-2 [x](#9) `see #10`',
    'Not a heading:\n# 10 things',
    'A code span that is exactly one: `#8`.',
  ].join('\n')
  expect(findIssues(text)).toEqual(['#12', '#7', '#3456789', '#8'])
})

test('issue-links: #N in a reply links to the GitHub issue on every surface, drawn by the engine', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  for (const surface of SURFACES) {
    const ui = await mountAssistant($, surface, assistant('This closes #12 and touches (#7).', false))
    expect(rootProps(await ui.drawn()).key).toBe(ENGINE_KEY)
    expect(await drawnText(ui)).toBe(`This closes [#12](${ISSUES}/12) and touches ([#7](${ISSUES}/7)).`)
    await ui.unmount()
  }
})

test('issue-links: the rewritten reply goes on to the hooks beneath, so another link rule stacks', async ($, on) => {
  on('ui.log', () => ({ value: undefined }))
  repository(on, GITHUB)
  let seen: unknown[] = []
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    seen = [...seen, e.props]
    const { Text } = $.ui.resolve(e)
    return h(Text, { key: ENGINE_KEY }, e.props.text) as RenderElement
  })
  const ui = await mountAssistant($, 'terminal', { ...assistant('Fixed in 3f9e2a1, closes #42.'), onScreen: null })
  expect(seen).toEqual([{ text: `Fixed in 3f9e2a1, closes [#42](${ISSUES}/42).`, isFirstOfReply: true, onScreen: null }])
  await ui.unmount()
})

test('issue-links: a link another rule drew above it is kept', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  const sha = '[3f9e2a1](https://github.com/baselane/mods/commit/3f9e2a1)'
  const ui = await mountAssistant($, 'terminal', assistant(`Fixed in ${sha}, closes #42.`))
  expect(await drawnText(ui)).toBe(`Fixed in ${sha}, closes [#42](${ISSUES}/42).`)
  await ui.unmount()
})

test('issue-links: a GitLab origin links under /-/issues/', async ($, on) => {
  standIn(on)
  repository(on, 'git@gitlab.com:group/proj.git')
  const ui = await mountAssistant($, 'terminal', assistant('See #4.', false))
  expect(await drawnText(ui)).toBe('See [#4](https://gitlab.com/group/proj/-/issues/4).')
  await ui.unmount()
})

test('issue-links: a code span that is exactly #N links whole; fenced code and links stay', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  const text = ['Tracked in `#21`, see [notes](#22).', '```', 'echo #23', '```'].join('\n')
  const ui = await mountAssistant($, 'terminal', assistant(text, false))
  expect(await drawnText(ui)).toBe(['Tracked in [`#21`](' + ISSUES + '/21), see [notes](#22).', '```', 'echo #23', '```'].join('\n'))
  await ui.unmount()
})

for (const [name, remote] of [
  ['no origin', null],
  ['another host', 'https://bitbucket.org/team/repo.git'],
  ['no repository', undefined],
] as const) {
  test(`issue-links: ${name} leaves the reply as written`, async ($, on) => {
    standIn(on)
    repository(on, remote)
    const ui = await mountAssistant($, 'terminal', assistant('Closes #12.'))
    expect(rootProps(await ui.drawn()).key).toBe(ENGINE_KEY)
    expect(await drawnText(ui)).toBe('Closes #12.')
    await ui.unmount()
  })
}

test('issue-links: a reply with no reference does not read the remote, and the remote is read once', async ($, on) => {
  standIn(on)
  const repo = repository(on, GITHUB)
  const plain = await mountAssistant($, 'terminal', assistant('Step 1: run the tests. Color #a1b2c3.'))
  expect(rootProps(await plain.drawn()).key).toBe(ENGINE_KEY)
  expect(repo.reads()).toBe(0)
  await plain.unmount()
  const ui = await mountAssistant($, 'terminal', assistant('Closes #12.'))
  await ui.redraw(assistant('Closes #12 and #13.'))
  expect(repo.reads()).toBe(1)
  await ui.unmount()
})

test('issue-links: the rule draws no Markdown or bullet of its own; the engine keeps the reply bullet', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  const first = await mountAssistant($, 'terminal', assistant('Closes #12.'))
  expect(await first.find({ key: KEY })).toBeUndefined()
  expect(await first.find({ type: 'Text', text: '⏺ ' })).toBeUndefined()
  expect(await drawnText(first)).toBe(`Closes [#12](${ISSUES}/12).`)
  await first.unmount()
})
