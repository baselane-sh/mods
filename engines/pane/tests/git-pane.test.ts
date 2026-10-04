import { expect, test } from 'claude-code/testing'

import { CWD, SURFACES, probe } from './probe'
import type { Answer } from './probe'

const STATUS = `git --no-optional-locks -C ${CWD} status --porcelain=v2 --branch`
const LOG = `git --no-optional-locks -C ${CWD} log -5 --format=%h%x09%cr%x09%s`
const RULE = '─'.repeat(72)

// Real `git status --porcelain=v2 --branch` output from a scratch repo (one
// staged, one unstaged and one both, a rename, a deletion, an add and an
// untracked folder), with one unmerged line added by hand.
const STATUS_OUT = [
  '# branch.oid 7763a3b976269ce45c815c8870048f0e225e28ea',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +1 -0',
  '1 M. N... 100644 100644 100644 93829c7b4af9dfbeea3b31395b042a614d7a190d fb23d832dabe218badeb9eb115c4c65a36f8b696 a.ts',
  '1 .M N... 100644 100644 100644 61780798228d17af2d34fce4cfbdf35556832472 61780798228d17af2d34fce4cfbdf35556832472 b.json',
  '1 MM N... 100644 100644 100644 f2ad6c76f0115a6ba5b00456a849810e7ec0af20 1429e5051801af960542f6c44346acd421555edc c.mjs',
  '2 R. N... 100644 100644 100644 4286f428e3b19fe84de503916ce0e7dc8deefea1 4286f428e3b19fe84de503916ce0e7dc8deefea1 R100 new.ts\told.ts',
  '1 .D N... 100644 100644 000000 4bcfe98e640c8284511312660fb8709b0afa888e 4bcfe98e640c8284511312660fb8709b0afa888e old file.txt',
  '1 A. N... 000000 100644 100644 0000000000000000000000000000000000000000 110ed9b99bc169eb3a675b6a9c7d4c739184cefc view.tsx',
  'u UU N... 100644 100644 100644 100644 aaaa bbbb cccc merge.ts',
  '? notes/',
  '',
].join('\n')

const LOG_OUT = '7763a3b\t1 second ago\tAdd the pane engine\n648b6b0\t2 hours ago\tInitial commit\n'

const REPO: Record<string, Answer> = { [STATUS]: { stdout: STATUS_OUT }, [LOG]: { stdout: LOG_OUT } }

const statusRuns = (runs: readonly string[]) => runs.filter(run => run === STATUS).length

test('git-pane: /git is registered at session start', async ($, on) => {
  const session = probe($, on, REPO)
  await session.start()
  expect(session.commands()).toEqual(['git'])
})

test('git-pane: /git opens a pane that Esc closes, and /git again closes it', async ($, on) => {
  const session = probe($, on, REPO)
  expect((await session.command('git')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'git', title: 'Git', closeOnEscape: true }])
  expect((await session.command('git')).text).toContain('closed')
  expect(session.closes()).toEqual(['git'])
})

test('git-pane: branch, upstream, changes and commits at 72 columns on every surface', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('git')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'git', 72)
    expect((await ui.find({ key: 'header' }))?.text).toBe('Git  updated 12:34:56')
    expect(await session.lines(ui)).toEqual([
      'main  tracks origin/main  ahead 1  behind 0',
      RULE,
      'Changes  4 staged  3 unstaged  1 conflict  1 untracked',
      'M. a.ts',
      '.M b.json',
      'MM c.mjs',
      'R. old.ts → new.ts',
      '.D old file.txt',
      'A. view.tsx',
      'UU merge.ts',
      '?? notes/',
      RULE,
      'Last 2 commits, newest first',
      '7763a3b  1 second ago  Add the pane engine',
      '648b6b0  2 hours ago  Initial commit',
    ])
    await ui.unmount()
  }
})

test('git-pane: staged letters are green, unstaged red, and the letters say it without color', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('git')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'git')
    const row = await ui.find({ key: 'line-file-c.mjs' })
    expect(row?.text).toBe('MM c.mjs')
    const letters = await ui.findAll({ type: 'Text', text: 'M' })
    expect(letters.map(letter => letter.props.color)).toContain('green')
    expect(letters.map(letter => letter.props.color)).toContain('red')
    await ui.unmount()
  }
})

test('git-pane: outside a repo the pane says so', async ($, on) => {
  const session = probe($, on, {
    [STATUS]: { exitCode: 128, stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' },
  })
  await session.command('git')
  const ui = await session.mount('terminal', 'git')
  expect(await session.lines(ui)).toEqual([`Not a git repository: ${CWD}`])
  await ui.unmount()
})

test('git-pane: a git that does not start is reported, not thrown', async ($, on) => {
  const session = probe($, on, { [STATUS]: { reject: 'spawn git ENOENT' } })
  await session.command('git')
  const ui = await session.mount('terminal', 'git')
  // The kit skips a test hook that throws, so the plugin sees its own
  // rejection text, not this one; the line still says git did not run.
  expect((await session.lines(ui))[0]).toMatch(/^git did not run: /)
  await ui.unmount()
})

test('git-pane: a detached head, no upstream and no commits read plainly', async ($, on) => {
  const session = probe($, on, {
    [STATUS]: { stdout: '# branch.oid 7763a3b976269ce45c815c8870048f0e225e28ea\n# branch.head (detached)\n' },
    [LOG]: { stdout: LOG_OUT },
  })
  await session.command('git')
  const ui = await session.mount('terminal', 'git')
  expect((await session.lines(ui)).slice(0, 3)).toEqual(['detached at 7763a3b  no upstream', RULE, 'No changes'])
  await ui.unmount()

  session.answer(STATUS, { stdout: '# branch.oid (initial)\n# branch.head main\n? a.ts\n' })
  session.answer(LOG, { exitCode: 128, stderr: "fatal: your current branch 'main' does not have any commits yet\n" })
  await session.clock.advance(15_000)
  const fresh = await session.mount('terminal', 'git')
  expect(await session.lines(fresh)).toEqual([
    'main  no upstream',
    RULE,
    'Changes  1 untracked',
    '?? a.ts',
    RULE,
    'No commits yet',
  ])
  await fresh.unmount()
})

test('git-pane: refreshes every 15 seconds while open and stops when /git closes it', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('git')
  expect(statusRuns(session.runs())).toBe(1)
  await session.clock.advance(15_000)
  expect(statusRuns(session.runs())).toBe(2)
  await session.clock.advance(15_000)
  expect(statusRuns(session.runs())).toBe(3)

  await session.command('git')
  await session.clock.advance(60_000)
  expect(statusRuns(session.runs())).toBe(3)
})

test('git-pane: the timer stops once the person closes the pane', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('git')
  session.personClose('git')
  await session.clock.advance(15_000)
  await session.clock.advance(60_000)
  expect(statusRuns(session.runs())).toBe(1)
})

test('git-pane: git commands, writes and edits refresh it; reads and other commands do not', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('git')
  await session.clock.advance(2_000)

  await session.bash('git commit -m "wip"')
  expect(statusRuns(session.runs())).toBe(2)
  await session.clock.advance(2_000)
  await session.call({ tool: 'Write', file_path: `${CWD}/a.ts`, content: 'x' })
  expect(statusRuns(session.runs())).toBe(3)
  await session.clock.advance(2_000)
  await session.call({ tool: 'Edit', file_path: `${CWD}/a.ts`, old_string: 'x', new_string: 'y' })
  expect(statusRuns(session.runs())).toBe(4)
  await session.clock.advance(2_000)
  await session.call({ tool: 'Read', file_path: `${CWD}/a.ts` })
  await session.bash('ls -la')
  await session.bash('echo digit')
  expect(statusRuns(session.runs())).toBe(4)
})

test('git-pane: a closed pane runs nothing after a tool call', async ($, on) => {
  const session = probe($, on, REPO)
  await session.bash('git status')
  await session.call({ tool: 'Write', file_path: `${CWD}/a.ts`, content: 'x' })
  expect(session.runs()).toEqual([])
})

test('git-pane: never refreshes more than once a second, and a burst ends with one refresh', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('git')
  for (let n = 0; n < 5; n += 1) await session.call({ tool: 'Edit', file_path: `${CWD}/a.ts`, old_string: 'a', new_string: 'b' })
  expect(statusRuns(session.runs())).toBe(1)
  await session.clock.advance(999)
  expect(statusRuns(session.runs())).toBe(1)
  await session.clock.advance(1)
  expect(statusRuns(session.runs())).toBe(2)
  await session.clock.advance(5_000)
  expect(statusRuns(session.runs())).toBe(2)
})

test('git-pane: lines fit narrow panes on every surface', async ($, on) => {
  const session = probe($, on, REPO)
  await session.command('git')
  for (const surface of SURFACES) {
    for (const columns of [40, 24, 10]) {
      const ui = await session.mount(surface, 'git', columns)
      const texts = [(await ui.find({ key: 'header' }))?.text ?? '', ...(await session.lines(ui))]
      for (const text of texts) expect({ surface, columns, text, fits: text.length <= columns }).toEqual({ surface, columns, text, fits: true })
      await ui.unmount()
    }
  }
})

test('git-pane: a credential in a commit subject or a path is redacted', async ($, on) => {
  const key = 'sk-ant-' + 'api03-abcdefghijklmnopqrstuvwxyz'
  const session = probe($, on, {
    [STATUS]: { stdout: `# branch.oid abc\n# branch.head main\n? ${key}.txt\n` },
    [LOG]: { stdout: `abc1234\tnow\tadd ${key}\n` },
  })
  await session.command('git')
  const ui = await session.mount('terminal', 'git', 200)
  const text = (await session.lines(ui)).join('\n')
  expect(text).toContain('[REDACTED]')
  expect(text).not.toContain(key.slice(0, 12))
  await ui.unmount()
})

test('git-pane: a long list of changes is capped with a count of the rest', async ($, on) => {
  const many = Array.from({ length: 30 }, (_, n) => `? file-${n}.ts`).join('\n')
  const session = probe($, on, { [STATUS]: { stdout: `# branch.oid abc\n# branch.head main\n${many}\n` }, [LOG]: { stdout: LOG_OUT } })
  await session.command('git')
  const ui = await session.mount('terminal', 'git')
  const lines = await session.lines(ui)
  expect(lines.filter(text => text.startsWith('?? '))).toHaveLength(20)
  expect(lines).toContain('… and 10 more')
  await ui.unmount()
})
