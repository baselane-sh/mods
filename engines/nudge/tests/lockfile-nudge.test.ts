import { expect, test } from 'claude-code/testing'

import { probe, FAIL_WORD } from './probe'

const NUDGE = (names: string) => `lockfile-nudge: ${names} dependencies changed but no lockfile update or install ran. Run the install command.`
const DEP = '    "react": "^18.2.0",'

test('lockfile-nudge: a new package.json dependency gives one toast', async ($, on) => {
  const session = probe($, on)
  await session.edit('app/package.json', DEP)
  expect(await session.stop()).toEqual([NUDGE('app/package.json')])
})

test('lockfile-nudge: a Write that declares dependencies counts', async ($, on) => {
  const session = probe($, on)
  await session.write('package.json', '{\n  "dependencies": {\n    "left-pad": "1.3.0"\n  }\n}')
  expect(await session.stop()).toEqual([NUDGE('package.json')])
})

test('lockfile-nudge: edits that touch no dependency stay quiet', async ($, on) => {
  const session = probe($, on)
  await session.edit('package.json', '  "version": "2.0.0",', '  "version": "1.0.0",')
  await session.edit('package.json', '    "build": "tsc",')
  await session.edit('package.json', '    "node": ">=18"')
  expect(await session.stop()).toEqual([])
})

test('lockfile-nudge: editing the lockfile resolves it', async ($, on) => {
  const session = probe($, on)
  await session.edit('package.json', DEP)
  await session.edit('pnpm-lock.yaml')
  expect(await session.stop()).toEqual([])
})

for (const command of ['npm install', 'pnpm add react', 'yarn', 'bun install', 'npm ci']) {
  test(`lockfile-nudge: ${command} resolves it`, async ($, on) => {
    const session = probe($, on)
    await session.edit('package.json', DEP)
    await session.bash(command)
    expect(await session.stop()).toEqual([])
  })
}

test('lockfile-nudge: a lockfile in another folder does not resolve it', async ($, on) => {
  const session = probe($, on)
  await session.edit('app/package.json', DEP)
  await session.edit('lib/package-lock.json')
  expect(await session.stop()).toEqual([NUDGE('app/package.json')])
})

test('lockfile-nudge: a failed install does not resolve it', async ($, on) => {
  const session = probe($, on)
  await session.edit('package.json', DEP)
  await session.bash(`npm install ${FAIL_WORD}`)
  expect(await session.stop()).toEqual([NUDGE('package.json')])
})

test('lockfile-nudge: a read-only command is not an install', async ($, on) => {
  const session = probe($, on)
  await session.edit('package.json', DEP)
  await session.bash('echo npm install')
  await session.bash('npm run build')
  expect(await session.stop()).toEqual([NUDGE('package.json')])
})

const CASES: [string, string, string, string][] = [
  ['pyproject.toml', '    "requests>=2.31",', 'uv.lock', 'uv sync'],
  ['pyproject.toml', 'requests = "^2.31"', 'poetry.lock', 'poetry lock'],
  ['Cargo.toml', 'serde = "1.0"', 'Cargo.lock', 'cargo update'],
  ['go.mod', '\tgithub.com/spf13/cobra v1.8.0', 'go.sum', 'go mod tidy'],
]

for (const [manifest, line, lock, install] of CASES) {
  test(`lockfile-nudge: ${manifest} (${lock}) gives a toast when nothing follows`, async ($, on) => {
    const session = probe($, on)
    await session.edit(manifest, line)
    expect(await session.stop()).toEqual([NUDGE(manifest)])
  })

  test(`lockfile-nudge: ${lock} edit resolves ${manifest}`, async ($, on) => {
    const session = probe($, on)
    await session.edit(manifest, line)
    await session.edit(lock)
    expect(await session.stop()).toEqual([])
  })

  test(`lockfile-nudge: ${install} resolves ${manifest}`, async ($, on) => {
    const session = probe($, on)
    await session.edit(manifest, line)
    await session.bash(install)
    expect(await session.stop()).toEqual([])
  })
}

test('lockfile-nudge: an install for another ecosystem does not resolve it', async ($, on) => {
  const session = probe($, on)
  await session.edit('Cargo.toml', 'serde = "1.0"')
  await session.bash('npm install')
  expect(await session.stop()).toEqual([NUDGE('Cargo.toml')])
})

test('lockfile-nudge: non-dependency lines in toml and go.mod stay quiet', async ($, on) => {
  const session = probe($, on)
  await session.edit('Cargo.toml', 'version = "0.2.0"')
  await session.edit('pyproject.toml', 'name = "tool"')
  await session.edit('go.mod', 'go 1.22')
  expect(await session.stop()).toEqual([])
})

test('lockfile-nudge: one toast per batch and a later turn starts clean', async ($, on) => {
  const session = probe($, on)
  await session.edit('package.json', DEP)
  await session.stop()
  expect(await session.stop()).toEqual([])
})

test('lockfile-nudge: several manifests are named together', async ($, on) => {
  const session = probe($, on)
  await session.edit('package.json', DEP)
  await session.edit('Cargo.toml', 'serde = "1.0"')
  expect(await session.stop()).toEqual([NUDGE('package.json, Cargo.toml')])
})

test('lockfile-nudge: a Write over package.json that keeps its dependencies stays quiet', async ($, on) => {
  const session = probe($, on)
  const deps = '  "dependencies": {\n    "left-pad": "1.3.0"\n  }\n}'
  await session.write('package.json', `{\n  "private": true,\n${deps}`, `{\n  "private": false,\n${deps}`)
  expect(await session.stop()).toEqual([])
})

test('lockfile-nudge: package fields and scripts that only look like versions or links stay quiet', async ($, on) => {
  const session = probe($, on)
  await session.edit('package.json', '    "prepare": "git config core.hooksPath .githooks",')
  await session.edit('package.json', '  "homepage": "https://example.com",')
  await session.edit('package.json', '  "repository": "github:me/repo",')
  await session.edit('package.json', '    "url": "git+https://github.com/me/repo.git"')
  await session.edit('package.json', '  "description": "3 helpers",')
  await session.edit('package.json', '  "name": "git-tools",')
  expect(await session.stop()).toEqual([])
})

for (const line of ['    "foo": "git+https://github.com/me/foo.git",', '    "foo": "github:me/foo",', '    "foo": "git://github.com/me/foo.git",', '    "url": "^0.11.0",']) {
  test(`lockfile-nudge: the dependency ${line.trim()} still counts`, async ($, on) => {
    const session = probe($, on)
    await session.edit('package.json', line)
    expect(await session.stop()).toEqual([NUDGE('package.json')])
  })
}
