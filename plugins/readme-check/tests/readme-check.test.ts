import { expect, test } from 'claude-code/testing'

import { IN_REPO } from './fixtures'
import { probe } from './probe'

const git = { ...IN_REPO, 'rev-parse --show-toplevel': '/repo\n' }
const readme = (text: string, files: string[] = [], name = 'README.md') => ({
  git,
  dirs: { '/repo': [name, 'src/'] },
  contents: { [`/repo/${name}`]: text },
  files,
})

const FULL = ['# Proj', '', '## Installation', 'x', '## Usage', 'x', '## License', 'MIT', '## Contributing', 'PRs'].join('\n')

test('readme-check: registers /readme-check with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'readme-check')?.description).toMatch(/missing/i)
})

test('readme-check: a complete README with good links is clean', async ($, on) => {
  const session = probe($, on, readme(`${FULL}\nSee [guide](docs/guide.md#top) and ![i](img/a.png "t")`, ['/repo/docs/guide.md', '/repo/img/a.png']))
  const text = await session.run('readme-check')
  expect(text).toContain('Sections: install, usage, licence and contributing are all there.')
  expect(text).toContain('Relative links: none broken.')
})

test('readme-check: names the missing sections', async ($, on) => {
  const session = probe($, on, readme('# Proj\n\n## Usage\nrun it\n'))
  const text = await session.run('readme-check')
  expect(text).toContain('Missing sections (3): install, licence, contributing')
})

test('readme-check: a section named in prose or a code block does not count', async ($, on) => {
  const session = probe($, on, readme('# Proj\n\nSee the license below.\n\n```\n## Installation\n```\n'))
  const text = await session.run('readme-check')
  expect(text).toContain('Missing sections (4): install, usage, licence, contributing')
})

test('readme-check: setext headings and the spellings Licence, Quick start and Contribute count', async ($, on) => {
  const session = probe($, on, readme('Proj\n====\n\nSetup\n-----\n\n# Quick start\n\n### Licence\n\n## How to contribute\n'))
  expect(await session.run('readme-check')).toContain('all there')
})

test('readme-check: reports broken relative links with line numbers', async ($, on) => {
  const text = `${FULL}\n[a](docs/gone.md)\n[b](src/ok.ts)\n![c](./img/missing.png)\n`
  const session = probe($, on, readme(text, ['/repo/src/ok.ts']))
  const out = await session.run('readme-check')
  expect(out).toContain('Broken relative links (2 links):')
  expect(out).toContain('- README.md:11  docs/gone.md')
  expect(out).toContain('- README.md:13  ./img/missing.png')
  expect(out).not.toContain('src/ok.ts')
})

test('readme-check: web links, anchors, mail links, absolute paths and links in code are skipped', async ($, on) => {
  const text = `${FULL}\n[a](https://x.io/nope) [b](#usage) [c](mailto:a@b.c) [d](/abs/path) [e](//cdn/x)\n\`\`\`\n[f](in/code.md)\n\`\`\`\n`
  const session = probe($, on, readme(text))
  expect(await session.run('readme-check')).toContain('Relative links: none broken.')
})

test('readme-check: a link that climbs out of the repo is skipped, not checked', async ($, on) => {
  const session = probe($, on, readme(`${FULL}\n[a](../../etc/passwd)\n`))
  const out = await session.run('readme-check')
  expect(out).toContain('Relative links: none broken.')
})

test('readme-check: a percent-encoded link is decoded before the check', async ($, on) => {
  const session = probe($, on, readme(`${FULL}\n[a](my%20doc.md)\n`, ['/repo/my doc.md']))
  expect(await session.run('readme-check')).toContain('Relative links: none broken.')
})

test('readme-check: caps the broken links at 30', async ($, on) => {
  const links = Array.from({ length: 35 }, (_, i) => `[l](gone${i}.md)`).join('\n')
  const session = probe($, on, readme(`${FULL}\n${links}\n`))
  const out = await session.run('readme-check')
  expect(out).toContain('Broken relative links (35 links):')
  expect(out).toContain('and 5 more')
})

test('readme-check: finds README.rst when there is no markdown one', async ($, on) => {
  const session = probe($, on, readme('Proj\n====\n', [], 'README.rst'))
  expect(await session.run('readme-check')).toContain('README check: README.rst')
})

test('readme-check: no README says so and copies nothing', async ($, on) => {
  const session = probe($, on, { git, dirs: { '/repo': ['package.json'] } })
  expect(await session.run('readme-check')).toBe('No README at the repo root.')
  expect(session.copied()).toEqual([])
})

test('readme-check: an unreadable README says so', async ($, on) => {
  const session = probe($, on, { git, dirs: { '/repo': ['README.md'] } })
  expect(await session.run('readme-check')).toBe('Could not read README.md.')
})

test('readme-check: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('readme-check')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('readme-check: only reads, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, readme(FULL))
  await session.run('readme-check')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
})
