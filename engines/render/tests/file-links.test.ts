import { expect, test } from 'claude-code/testing'

import { findRefs, linkRefs, MAX_MARKDOWN, insideOf } from '../hooks/refs'
import { assistant, CWD, ENGINE_KEY, mountAssistant, standIn, SURFACES, workspace, rootProps } from './probe'

const KEY = 'file-links'
const APP = `${CWD}/src/app.ts`
const UTIL = `${CWD}/lib/util.ts`
const HREF_APP = `file://${APP}`
const HREF_UTIL = `file://${UTIL}`

const REPLY = 'The bug is in src/app.ts:42, called from `lib/util.ts:7`. See also src/gone.ts:3.'

type Ui = Awaited<ReturnType<typeof mountAssistant>>

const markdown = async (ui: Ui) => ui.find({ key: KEY })

test('file-links: findRefs names path:line references outside code blocks and links', () => {
  const text = [
    'Look at src/app.ts:42 and ./lib/util.ts:7:3 and `pkg/mod.go:9`.',
    'Not https://example.com:443/a.ts:4 or http://localhost:3000 or v1.2:3.',
    'Not [a link](src/app.ts:1) and not `npm run x:1` either.',
    '```ts',
    'const ignored = "src/in-fence.ts:1"',
    '```',
    'Twice: src/app.ts:50.',
  ].join('\n')
  expect(findRefs(text)).toEqual(['src/app.ts', './lib/util.ts', 'pkg/mod.go'])
})

test('file-links: insideOf keeps paths inside the working directory only', () => {
  expect(insideOf(CWD, 'src/app.ts')).toBe('src/app.ts')
  expect(insideOf(CWD, './lib/../src/app.ts')).toBe('src/app.ts')
  expect(insideOf(CWD, `${CWD}/src/app.ts`)).toBe('src/app.ts')
  expect(insideOf(CWD, '../secret.ts')).toBeUndefined()
  expect(insideOf(CWD, 'src/../../secret.ts')).toBeUndefined()
  expect(insideOf(CWD, '/etc/hosts.txt')).toBeUndefined()
  expect(insideOf(`${CWD}/`, 'a.ts')).toBe('a.ts')
  expect(insideOf('/', 'etc/a.ts')).toBe('etc/a.ts')
})

test('file-links: linkRefs writes markdown links, a whole code span inside the link', () => {
  const hrefOf = (path: string) => (path === 'src/app.ts' || path === 'lib/util.ts' ? `file:///repo/${path}` : undefined)
  expect(linkRefs(REPLY, hrefOf)).toBe(
    'The bug is in [src/app.ts:42](file:///repo/src/app.ts), called from [`lib/util.ts:7`](file:///repo/lib/util.ts). See also src/gone.ts:3.',
  )
})

test('file-links: a reply naming files that exist draws pressable links on every surface', async ($, on) => {
  standIn(on)
  workspace(on, [APP, UTIL])
  for (const surface of SURFACES) {
    const ui = await mountAssistant($, surface, assistant(REPLY, false))
    const found = await markdown(ui)
    expect(found?.type).toBe('Markdown')
    expect(found?.props.text).toBe(
      `The bug is in [src/app.ts:42](${HREF_APP}), called from [\`lib/util.ts:7\`](${HREF_UTIL}). See also src/gone.ts:3.`,
    )
    expect(found?.props.pressableLinks).toEqual([HREF_APP, HREF_UTIL])
    expect(await ui.find({ key: ENGINE_KEY })).toBeUndefined()
    await ui.unmount()
  }
})

test('file-links: pressing a link puts @path in the prompt at the cursor', async ($, on) => {
  standIn(on)
  const session = workspace(on, [APP, UTIL])
  for (const surface of SURFACES) {
    const ui = await mountAssistant($, surface, assistant(REPLY))
    await ui.press({ key: KEY, link: { href: HREF_UTIL } })
    await ui.unmount()
  }
  expect(session.fills().map(fill => [fill.text, fill.mode])).toEqual([
    ['@lib/util.ts ', 'insert'],
    ['@lib/util.ts ', 'insert'],
  ])
})

test('file-links: an absolute path inside the project links and inserts it relative', async ($, on) => {
  standIn(on)
  const session = workspace(on, [APP])
  const ui = await mountAssistant($, 'terminal', assistant(`Fixed in ${APP}:12.`, false))
  expect((await markdown(ui))?.props.text).toBe(`Fixed in [${APP}:12](${HREF_APP}).`)
  await ui.press({ key: KEY, link: { href: HREF_APP } })
  expect(session.fills().map(fill => fill.text)).toEqual(['@src/app.ts '])
  await ui.unmount()
})

test('file-links: no reference to an existing file leaves the engine drawing', async ($, on) => {
  standIn(on)
  const session = workspace(on, [APP], [`${CWD}/docs.d`])
  const replies = [
    'Nothing to link here.',
    'Only src/gone.ts:3 which does not exist.',
    'A folder docs.d:4 is not a file.',
    'Outside: ../secret.ts:1 and /etc/hosts.txt:2.',
    '```\nsrc/app.ts:1\n```',
  ]
  for (const surface of SURFACES) {
    for (const text of replies) {
      const ui = await mountAssistant($, surface, assistant(text))
      const drawn = await ui.drawn()
      expect({ surface, text, key: rootProps(drawn).key }).toEqual({ surface, text, key: ENGINE_KEY })
      await ui.unmount()
    }
  }
  // A path outside the project is never looked up.
  expect(session.stats().filter(path => !path.startsWith(`${CWD}/`))).toEqual([])
})

test('file-links: each path is looked up once, then cached', async ($, on) => {
  standIn(on)
  const session = workspace(on, [APP])
  const ui = await mountAssistant($, 'terminal', assistant('See src/app.ts:1 and src/gone.ts:2.'))
  await ui.redraw(assistant('See src/app.ts:1 and src/gone.ts:2, and src/app.ts:9.'))
  await ui.redraw()
  const desktop = await mountAssistant($, 'desktop', assistant('Again src/app.ts:3.'))
  expect([...session.stats()].sort()).toEqual([APP, `${CWD}/src/gone.ts`])
  await ui.unmount()
  await desktop.unmount()
})

test('file-links: the first block of a reply keeps its bullet on the terminal', async ($, on) => {
  standIn(on)
  workspace(on, [APP])
  const first = await mountAssistant($, 'terminal', assistant('Open src/app.ts:1.'))
  expect(await first.find({ type: 'Text', text: '⏺ ' })).toBeDefined()
  expect((await markdown(first))?.props.text).toBe(`Open [src/app.ts:1](${HREF_APP}).`)
  await first.unmount()

  const later = await mountAssistant($, 'terminal', assistant('Open src/app.ts:1.', false))
  expect(await later.find({ type: 'Text', text: '⏺ ' })).toBeUndefined()
  await later.unmount()

  const desktop = await mountAssistant($, 'desktop', assistant('Open src/app.ts:1.'))
  expect(await desktop.find({ type: 'Text', text: '⏺ ' })).toBeUndefined()
  expect(await markdown(desktop)).toBeDefined()
  await desktop.unmount()
})

test('file-links: a reply too long to redraw as markdown keeps the engine drawing', async ($, on) => {
  standIn(on)
  workspace(on, [APP])
  const text = `src/app.ts:1 ${'x'.repeat(MAX_MARKDOWN)}`
  const ui = await mountAssistant($, 'terminal', assistant(text.slice(0, MAX_MARKDOWN)))
  const drawn = await ui.drawn()
  expect(rootProps(drawn).key).toBe(ENGINE_KEY)
  await ui.unmount()
})
