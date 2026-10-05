import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { forgeOf } from '../hooks/forge'
import { findShas } from '../hooks/rules/sha-links'
import { assistant, bashOutput, drawnText, ENGINE_KEY, mountAssistant, mountToolUse, repository, rootProps, standIn, SURFACES, toolUse } from './probe'

const KEY = 'sha-links'
const GITHUB = 'git@github.com:baselane/mods.git'
const SHA = '3f9e2a1'
const FULL = '3f9e2a1c0b8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f'
const HREF = `https://github.com/baselane/mods/commit/${SHA}`


test('sha-links: findShas keeps 7 to 40 lowercase hex with a digit and a letter, once each', () => {
  const text = [
    `Fixed in ${SHA} and ${FULL}; range ${SHA}..a1b2c3d4. Again ${SHA}.`,
    'Not: 1234567 deadbeef defaced ABC1234 0x1a2b3c4d #a1b2c3d4 abc12 file.a1b2c3d4',
    'Not: 550e8400-e29b-41d4-a716-446655440000 or a 64 digit one',
    `${'ab12'.repeat(16)} or https://x.dev/a1b2c3d4e5 or ?sha=a1b2c3d4 or a1b2c3d4/x or a1b2c3d4.ts`,
  ].join('\n')
  expect(findShas(text)).toEqual([SHA, FULL, 'a1b2c3d4'])
})

test('sha-links: forgeOf reads GitHub and GitLab remotes and keeps no user or token', () => {
  const project = { host: 'github.com', path: 'baselane/mods' }
  expect(forgeOf(GITHUB)).toEqual(project)
  expect(forgeOf('https://github.com/baselane/mods')).toEqual(project)
  expect(forgeOf('https://github.com/baselane/mods.git/')).toEqual(project)
  expect(forgeOf('ssh://git@github.com:22/baselane/mods.git')).toEqual(project)
  expect(forgeOf('https://bob:' + 'ghp_' + 'x'.repeat(36) + '@github.com/baselane/mods.git')).toEqual(project)
  expect(forgeOf('git@gitlab.com:group/sub/proj.git')).toEqual({ host: 'gitlab.com', path: 'group/sub/proj' })
  expect(forgeOf('https://GitHub.com/baselane/mods')).toEqual(project)
  expect(forgeOf('git@bitbucket.org:team/repo.git')).toBeUndefined()
  expect(forgeOf('https://github.com/baselane')).toBeUndefined()
  expect(forgeOf('https://github.com/a/b/c')).toBeUndefined()
  expect(forgeOf('/srv/git/mods.git')).toBeUndefined()
  expect(forgeOf('https://github.com/a/..')).toBeUndefined()
  expect(forgeOf(null)).toBeUndefined()
})

test('sha-links: a SHA in a reply links to its GitHub commit page on every surface, drawn by the engine', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  for (const surface of SURFACES) {
    const ui = await mountAssistant($, surface, assistant(`Committed as ${SHA}, then \`${FULL}\`.`, false))
    expect(rootProps(await ui.drawn()).key).toBe(ENGINE_KEY)
    expect(await drawnText(ui)).toBe(`Committed as [${SHA}](${HREF}), then [\`${FULL}\`](https://github.com/baselane/mods/commit/${FULL}).`)
    await ui.unmount()
  }
})

test('sha-links: the rewritten reply goes on to the hooks beneath, so another link rule stacks', async ($, on) => {
  on('ui.log', () => ({ value: undefined }))
  repository(on, GITHUB)
  let seen: unknown[] = []
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    seen = [...seen, e.props]
    const { Text } = $.ui.resolve(e)
    return h(Text, { key: ENGINE_KEY }, e.props.text) as RenderElement
  })
  const ui = await mountAssistant($, 'terminal', { ...assistant(`Fixed in ${SHA}, closes #42.`), onScreen: null })
  expect(seen).toEqual([{ text: `Fixed in [${SHA}](${HREF}), closes #42.`, isFirstOfReply: true, onScreen: null }])
  await ui.unmount()
})

test('sha-links: a link another rule drew above it is kept', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  const issue = '[#42](https://github.com/baselane/mods/issues/42)'
  const ui = await mountAssistant($, 'terminal', assistant(`Fixed in ${SHA}, closes ${issue}.`))
  expect(await drawnText(ui)).toBe(`Fixed in [${SHA}](${HREF}), closes ${issue}.`)
  await ui.unmount()
})

test('sha-links: a GitLab origin links under /-/commit/', async ($, on) => {
  standIn(on)
  repository(on, 'https://gitlab.com/group/sub/proj.git')
  const ui = await mountAssistant($, 'terminal', assistant(`See ${SHA}.`, false))
  expect(await drawnText(ui)).toBe(`See [${SHA}](https://gitlab.com/group/sub/proj/-/commit/${SHA}).`)
  await ui.unmount()
})

for (const [name, remote] of [
  ['no origin', null],
  ['another host', 'git@bitbucket.org:team/repo.git'],
  ['no repository', undefined],
] as const) {
  test(`sha-links: ${name} leaves the reply as written`, async ($, on) => {
    standIn(on)
    repository(on, remote)
    const ui = await mountAssistant($, 'terminal', assistant(`See ${SHA}.`))
    expect(rootProps(await ui.drawn()).key).toBe(ENGINE_KEY)
    expect(await drawnText(ui)).toBe(`See ${SHA}.`)
    await ui.unmount()
  })
}

test('sha-links: fenced code, existing links and URLs stay as written', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  const text = ['```', `git show ${SHA}`, '```', `[the fix](https://example.com/${SHA}) and https://github.com/x/y/commit/${SHA}`].join('\n')
  const ui = await mountAssistant($, 'terminal', assistant(text))
  expect(await drawnText(ui)).toBe(text)
  await ui.unmount()
})

test('sha-links: a token in the remote never reaches the drawing', async ($, on) => {
  standIn(on)
  const token = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789'
  repository(on, `https://bob:${token}@github.com/baselane/mods.git`)
  const ui = await mountAssistant($, 'terminal', assistant(`See ${SHA}.`, false))
  const text = String(await drawnText(ui))
  expect(text).toBe(`See [${SHA}](${HREF}).`)
  expect(text).not.toContain('bob')
  await ui.unmount()
})

test('sha-links: the remote is read once for the working directory', async ($, on) => {
  standIn(on)
  const repo = repository(on, GITHUB)
  const ui = await mountAssistant($, 'terminal', assistant(`See ${SHA}.`))
  await ui.redraw(assistant(`See ${SHA} and a1b2c3d4.`))
  await ui.redraw()
  const desktop = await mountAssistant($, 'desktop', assistant(`Again ${SHA}.`))
  expect(repo.reads()).toBe(1)
  await ui.unmount()
  await desktop.unmount()
})

test('sha-links: a reply without a SHA does not read the remote', async ($, on) => {
  standIn(on)
  const repo = repository(on, GITHUB)
  const ui = await mountAssistant($, 'terminal', assistant('Nothing here, only 1234567 and deadbeef.'))
  expect(rootProps(await ui.drawn()).key).toBe(ENGINE_KEY)
  expect(repo.reads()).toBe(0)
  await ui.unmount()
})

test('sha-links: the rule draws no Markdown or bullet of its own; the engine keeps the reply bullet', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  for (const surface of SURFACES) {
    const ui = await mountAssistant($, surface, assistant(`See ${SHA}.`))
    expect(await ui.find({ key: KEY })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '⏺ ' })).toBeUndefined()
    expect(rootProps(await ui.drawn()).key).toBe(ENGINE_KEY)
    await ui.unmount()
  }
})


test('sha-links: SHAs in the output of a git command are listed as commit links under the row', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  const log = `${SHA} Fix the build\na1b2c3d4 Add tests\n${SHA} again\n`
  for (const surface of SURFACES) {
    const ui = await mountToolUse($, surface, toolUse('Bash', { command: 'git log --oneline -3' }, { output: bashOutput(log) }))
    expect(await ui.find({ key: ENGINE_KEY })).toBeDefined()
    const links = await ui.findAll({ type: 'Link' })
    expect(links.map(link => [link.props.href, link.props.label])).toEqual([
      [HREF, SHA],
      ['https://github.com/baselane/mods/commit/a1b2c3d4', 'a1b2c3d4'],
    ])
    await ui.unmount()
  }
})

test('sha-links: a 40 character SHA is labelled by its first 12', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  const ui = await mountToolUse($, 'terminal', toolUse('Bash', { command: 'cd /repo && git rev-parse HEAD' }, { output: bashOutput(`${FULL}\n`) }))
  const [link] = await ui.findAll({ type: 'Link' })
  expect(link?.props.label).toBe(FULL.slice(0, 12))
  expect(link?.props.href).toBe(`https://github.com/baselane/mods/commit/${FULL}`)
  await ui.unmount()
})

test('sha-links: other commands, a running call and a row with no SHA keep the engine row alone', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  const cases = [
    toolUse('Bash', { command: 'docker ps' }, { output: bashOutput('a1b2c3d4e5f6 nginx Up 2 hours') }),
    toolUse('Bash', { command: 'echo legit' }, { output: bashOutput(SHA) }),
    toolUse('Bash', { command: 'git log' }, { isRunning: true }),
    toolUse('Bash', { command: 'git status' }, { output: bashOutput('nothing to commit') }),
    toolUse('Read', { file_path: '/repo/a.ts' }, { output: SHA }),
  ]
  for (const [index, props] of cases.entries()) {
    const ui = await mountToolUse($, 'terminal', props)
    expect({ index, key: rootProps(await ui.drawn()).key }).toEqual({ index, key: ENGINE_KEY })
    await ui.unmount()
  }
})
