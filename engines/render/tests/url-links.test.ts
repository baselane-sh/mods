import { expect, test } from 'claude-code/testing'

import { findUrls, linkable } from '../hooks/urls'
import { bashOutput, ENGINE_KEY, mountToolResult, rootProps, standIn, SURFACES, toolResult } from './probe'

const KEY = 'url-links'
const PR = 'https://github.com/baselane/mods/pull/7'
const LOCAL = 'http://localhost:3000/health'

test('url-links: findUrls keeps https and localhost URLs, trims punctuation and dedupes', () => {
  const text = [
    `Opened ${PR}. Again: (${PR})`,
    `Serving at ${LOCAL}, also http://example.com/plain and ftp://x.dev/a`,
    'Docs: https://en.wikipedia.org/wiki/Fold_(higher-order_function) and "https://a.dev/q?x=1&y=2"',
  ]
  expect(findUrls(text)).toEqual([PR, LOCAL, 'https://en.wikipedia.org/wiki/Fold_(higher-order_function)', 'https://a.dev/q?x=1&y=2'])
})

test('url-links: linkable refuses what a Link may not carry and encodes a raw @', () => {
  expect(linkable('https://user:pw@a.dev/x')).toBeUndefined()
  expect(linkable('http://example.com')).toBeUndefined()
  expect(linkable('https://')).toBeUndefined()
  expect(linkable(`https://a.dev/${'x'.repeat(2100)}`)).toBeUndefined()
  expect(linkable('https://www.npmjs.com/package/@scope/pkg')).toBe('https://www.npmjs.com/package/%40scope/pkg')
  expect(linkable('https://A.dev')).toBe('https://a.dev/')
  expect(linkable('https://café.dev/ü')).toBe('https://xn--caf-dma.dev/%C3%BC')
})

test('url-links: URLs in a Bash result are listed as links under the engine drawing', async ($, on) => {
  standIn(on)
  for (const surface of SURFACES) {
    const ui = await mountToolResult($, surface, toolResult('Bash', bashOutput(`Created ${PR}`, `see ${LOCAL}`)))
    const drawn = await ui.drawn()
    expect({ surface, direction: rootProps(drawn).flexDirection }).toEqual({ surface, direction: 'column' })
    expect(await ui.find({ key: ENGINE_KEY })).toBeDefined()
    const links = await ui.findAll({ type: 'Link' })
    expect(links.map(link => link.props.href)).toEqual([PR, LOCAL])
    expect((await ui.find({ key: KEY }))?.text).toContain(PR)
    await ui.unmount()
  }
})

test('url-links: an error text and a string output are searched too', async ($, on) => {
  standIn(on)
  const errored = await mountToolResult($, 'terminal', toolResult('Bash', `Exit code 22\ncurl: (22) ${PR}: 404`, { isErrored: true }))
  expect((await errored.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([PR])
  await errored.unmount()
  const fetched = await mountToolResult($, 'desktop', toolResult('Grep', `README.md: see ${PR}`))
  expect((await fetched.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual([PR])
  await fetched.unmount()
})

test('url-links: at most five links, then a count of the rest', async ($, on) => {
  standIn(on)
  const urls = Array.from({ length: 7 }, (_, i) => `https://a.dev/${i + 1}`)
  const ui = await mountToolResult($, 'terminal', toolResult('Bash', bashOutput(urls.join('\n'))))
  expect((await ui.findAll({ type: 'Link' })).map(link => link.props.href)).toEqual(urls.slice(0, 5))
  expect(await ui.find({ type: 'Text', text: /\+2 more/ })).toBeDefined()
  await ui.unmount()
})

test('url-links: output with no linkable URL keeps the engine drawing alone', async ($, on) => {
  standIn(on)
  const cases = [
    toolResult('Bash', bashOutput('no links here')),
    toolResult('Bash', bashOutput('only http://example.com and ftp://x.dev')),
    toolResult('Read', { type: 'text', file: { filePath: '/repo/a.md', content: PR, numLines: 1, startLine: 1, totalLines: 1 } }),
    toolResult('Bash', 42),
  ]
  for (const surface of SURFACES) {
    for (const [index, props] of cases.entries()) {
      const ui = await mountToolResult($, surface, props)
      const drawn = await ui.drawn()
      expect({ surface, index, key: rootProps(drawn).key }).toEqual({ surface, index, key: ENGINE_KEY })
      await ui.unmount()
    }
  }
})
