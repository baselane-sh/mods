import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const LONG = `npm run build -- ${'--flag '.repeat(40)}`

test('firewall view: an empty pane says so on every surface', async ($, on) => {
  const session = probe($, on)
  for (const surface of SURFACES) {
    const ui = await session.mount(surface)
    expect((await ui.find({ key: 'empty' }))?.text).toBe('No tool calls yet.')
    expect((await ui.find({ key: 'count-calls' }))?.text).toBe('0 calls')
    await ui.unmount()
  }
})

test('firewall view: rows fit the pane width on every surface', async ($, on) => {
  const session = probe($, on)
  await session.bash(LONG)
  await session.call({ tool: 'Read', file_path: `/repo/${'deep/'.repeat(30)}file.ts` })
  await session.bash('rm -rf /', 'blocked')

  for (const surface of SURFACES) {
    for (const columns of [120, 80, 40, 24]) {
      const ui = await session.mount(surface, columns)
      const rows = (await ui.findAll({ type: 'Box' })).filter(box => box.key?.startsWith('row-'))
      expect(rows).toHaveLength(3)
      for (const row of rows) {
        expect({ surface, columns, fits: row.text.length <= columns }).toEqual({ surface, columns, fits: true })
      }
      await ui.unmount()
    }
  }
})

test('firewall view: a wide pane shows the time, a narrow one drops it', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  for (const surface of SURFACES) {
    const wide = await session.mount(surface, 80)
    const [wideRow] = (await wide.findAll({ type: 'Box' })).filter(box => box.key?.startsWith('row-'))
    expect(wideRow?.text).toMatch(/^\d\d:\d\d:\d\d ✔ ran/)
    await wide.unmount()

    const narrow = await session.mount(surface, 40)
    const [narrowRow] = (await narrow.findAll({ type: 'Box' })).filter(box => box.key?.startsWith('row-'))
    expect(narrowRow?.text).toMatch(/^✔ ran/)
    await narrow.unmount()
  }
})

test('firewall view: a long summary is cut with an ellipsis', async ($, on) => {
  const session = probe($, on)
  await session.bash(LONG)
  const ui = await session.mount('terminal', 60)
  const [row] = (await ui.findAll({ type: 'Box' })).filter(box => box.key?.startsWith('row-'))
  expect(row?.text.trimEnd().endsWith('…')).toBe(true)
  await ui.unmount()
})

test('firewall view: the outcome mark is colored and still reads without color', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  await session.bash('rm -rf /', 'blocked')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface)
    const marks = await ui.findAll({ type: 'Text', text: /^(✔ ran|✘ blocked)/ })
    expect(marks.map(mark => [mark.text.trim(), mark.props.color])).toEqual([
      ['✘ blocked', 'red'],
      ['✔ ran', 'green'],
    ])
    await ui.unmount()
  }
})

test('firewall view: counters read singular for one', async ($, on) => {
  const session = probe($, on)
  await session.bash('npm run lint', 'error')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface)
    expect((await ui.find({ key: 'count-calls' }))?.text).toBe('1 call')
    expect((await ui.find({ key: 'count-errors' }))?.text).toBe('1 error')
    await ui.unmount()
  }
})
