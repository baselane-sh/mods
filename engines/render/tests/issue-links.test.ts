import { expect, test } from 'claude-code/testing'

import { findIssues } from '../hooks/rules/issue-links'
import { assistant, ENGINE_KEY, mountAssistant, repository, rootProps, standIn, SURFACES } from './probe'

const KEY = 'issue-links'
const GITHUB = 'https://github.com/baselane/mods.git'
const ISSUES = 'https://github.com/baselane/mods/issues'

type Ui = Awaited<ReturnType<typeof mountAssistant>>

const markdown = async (ui: Ui) => ui.find({ key: KEY })

test('issue-links: findIssues keeps #N references, not anchors, entities, other repos or code', () => {
  const text = [
    'Fixes #12 and (#7), see #12 again; #3456789.',
    'Not: &#123; owner/repo#9 a#5 #0 #12345678 #42abc #1-2 [x](#9) `see #10`',
    'Not a heading:\n# 10 things',
    'A code span that is exactly one: `#8`.',
  ].join('\n')
  expect(findIssues(text)).toEqual(['#12', '#7', '#3456789', '#8'])
})

test('issue-links: #N in a reply links to the GitHub issue on every surface', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  for (const surface of SURFACES) {
    const ui = await mountAssistant($, surface, assistant('This closes #12 and touches (#7).', false))
    const found = await markdown(ui)
    expect(found?.type).toBe('Markdown')
    expect(found?.props.text).toBe(`This closes [#12](${ISSUES}/12) and touches ([#7](${ISSUES}/7)).`)
    expect(await ui.find({ key: ENGINE_KEY })).toBeUndefined()
    await ui.unmount()
  }
})

test('issue-links: a GitLab origin links under /-/issues/', async ($, on) => {
  standIn(on)
  repository(on, 'git@gitlab.com:group/proj.git')
  const ui = await mountAssistant($, 'terminal', assistant('See #4.', false))
  expect((await markdown(ui))?.props.text).toBe('See [#4](https://gitlab.com/group/proj/-/issues/4).')
  await ui.unmount()
})

test('issue-links: a code span that is exactly #N links whole; fenced code and links stay', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  const text = ['Tracked in `#21`, see [notes](#22).', '```', 'echo #23', '```'].join('\n')
  const ui = await mountAssistant($, 'terminal', assistant(text, false))
  expect((await markdown(ui))?.props.text).toBe(['Tracked in [`#21`](' + ISSUES + '/21), see [notes](#22).', '```', 'echo #23', '```'].join('\n'))
  await ui.unmount()
})

for (const [name, remote] of [
  ['no origin', null],
  ['another host', 'https://bitbucket.org/team/repo.git'],
  ['no repository', undefined],
] as const) {
  test(`issue-links: ${name} leaves the engine drawing`, async ($, on) => {
    standIn(on)
    repository(on, remote)
    const ui = await mountAssistant($, 'terminal', assistant('Closes #12.'))
    expect(rootProps(await ui.drawn()).key).toBe(ENGINE_KEY)
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

test('issue-links: the first block of a reply keeps its bullet on the terminal', async ($, on) => {
  standIn(on)
  repository(on, GITHUB)
  const first = await mountAssistant($, 'terminal', assistant('Closes #12.'))
  expect(await first.find({ type: 'Text', text: '⏺ ' })).toBeDefined()
  expect((await markdown(first))?.props.text).toBe(`Closes [#12](${ISSUES}/12).`)
  await first.unmount()
})
