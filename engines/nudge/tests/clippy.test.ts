import { expect, test } from 'claude-code/testing'

import { DENY_WORD, probe } from './probe'

const clippy = (toasts: readonly string[]) => toasts.filter(text => text.startsWith('clippy: '))

test('clippy: a migrations folder gets the paperclip voice', async ($, on) => {
  const session = probe($, on)
  await session.write('db/migrations/0004_add_users.sql')
  expect(clippy(await session.stop())).toEqual([
    "clippy: It looks like you're writing a migration. Want me to remind you to back up first?",
  ])
})

for (const path of ['migrations/001.py', 'app/prisma/migrations/x/migration.sql']) {
  test(`clippy: migrations match as a folder name (${path}), with the Edit tool`, async ($, on) => {
    const session = probe($, on)
    await session.edit(path)
    expect(clippy(await session.stop()).length).toBe(1)
  })
}

test('clippy: a file that only mentions migrations stays quiet', async ($, on) => {
  const session = probe($, on)
  await session.write('src/migrationsHelper.ts')
  await session.write('docs/migrations-notes.md')
  await session.write('lib/migrations_backup/a.sql')
  await session.write('src/migration/a.ts')
  expect(clippy(await session.stop())).toEqual([])
})

for (const path of ['Dockerfile', 'services/api/Dockerfile.prod', 'build/app.dockerfile']) {
  test(`clippy: a Dockerfile (${path})`, async ($, on) => {
    const session = probe($, on)
    await session.write(path)
    const said = clippy(await session.stop())
    expect(said.length).toBe(1)
    expect(said[0]).toContain("It looks like you're editing a Dockerfile.")
  })
}

test('clippy: a GitHub workflow', async ($, on) => {
  const session = probe($, on)
  await session.edit('.github/workflows/ci.yml')
  const said = clippy(await session.stop())
  expect(said.length).toBe(1)
  expect(said[0]).toContain("It looks like you're editing a GitHub Actions workflow.")
})

test('clippy: other .github files and other yaml stay quiet', async ($, on) => {
  const session = probe($, on)
  await session.write('.github/CODEOWNERS')
  await session.write('config/ci.yml')
  expect(clippy(await session.stop())).toEqual([])
})

const RM_RF = ['rm -rf build', 'rm -fr build', 'rm -Rf build', 'rm -r -f build', 'rm --recursive --force build', 'cd x && rm -rf dist', `rm -rf ${DENY_WORD}`]
for (const command of RM_RF) {
  test(`clippy: rm -rf is noticed (${command}), even when the guard denied it`, async ($, on) => {
    const session = probe($, on)
    await session.bash(command)
    const said = clippy(await session.stop())
    expect(said.length).toBe(1)
    expect(said[0]).toContain("It looks like you're deleting files with rm -rf.")
  })
}

test('clippy: rm without both flags, and words that only contain rm, stay quiet', async ($, on) => {
  const session = probe($, on)
  for (const command of ['rm file.txt', 'rm -r build', 'rm -f x', 'npm run perform -rf', 'echo rm -rf', 'git rm -rf --cached x']) {
    await session.bash(command)
  }
  expect(clippy(await session.stop())).toEqual([])
})

test('clippy: once per session per trigger', async ($, on) => {
  const session = probe($, on)
  await session.write('migrations/001.sql')
  expect(clippy(await session.stop()).length).toBe(1)
  await session.write('migrations/002.sql')
  expect(clippy(await session.stop())).toEqual([])
})

test('clippy: at most one toast per turn, the other trigger waits for the next turn', async ($, on) => {
  const session = probe($, on)
  await session.write('migrations/001.sql')
  await session.write('Dockerfile')
  await session.bash('rm -rf out')
  const first = clippy(await session.stop())
  expect(first.length).toBe(1)
  expect(first[0]).toContain('migration')
  const second = clippy(await session.stop())
  expect(second.length).toBe(1)
  expect(second[0]).toContain('Dockerfile')
  const third = clippy(await session.stop())
  expect(third.length).toBe(1)
  expect(third[0]).toContain('rm -rf')
  expect(clippy(await session.stop())).toEqual([])
})

test('clippy: a turn with nothing to say raises no toast', async ($, on) => {
  const session = probe($, on)
  await session.write('src/app.ts')
  await session.bash('ls')
  expect(clippy(await session.stop())).toEqual([])
})

test('clippy: no em-dash in any line', async ($, on) => {
  const session = probe($, on)
  await session.write('migrations/1.sql')
  await session.write('Dockerfile')
  await session.edit('.github/workflows/a.yml')
  await session.bash('rm -rf x')
  const lines = [...(await session.stop()), ...(await session.stop()), ...(await session.stop()), ...(await session.stop())]
  expect(clippy(lines).length).toBe(4)
  expect(lines.every(line => !line.includes('\u2014'))).toBe(true)
})
