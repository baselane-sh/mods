import { expect, test } from 'claude-code/testing'

import { addedPathsIn, byteLength, WRITE_LIMIT } from '../hooks/rules/big-file'
import { probe } from './probe'

const BIG = (path: string) => `find ${path} -maxdepth 0 -type f -size +5242880c`
// The files that exist, and what the size probe answers for each.
const FS = {
  '/repo/big.bin': '/repo/big.bin',
  '/repo/small.txt': '/repo/small.txt',
  '/repo/sub/big.bin': '/repo/sub/big.bin',
  '/repo/docs': '/repo/docs',
  '/repo/odd.bin': '/repo/odd.bin',
  '/repo/media': '/repo/media',
}
const GLOB = (dir: string, pattern: string) => `find ${dir} -maxdepth 1 -name ${pattern} -type f -size +5242880c`
const SIZES = {
  [BIG('/repo/big.bin')]: '/repo/big.bin\n',
  [BIG('/repo/small.txt')]: '',
  [BIG('/repo/sub/big.bin')]: '/repo/sub/big.bin\n',
  [BIG('/repo/docs')]: '',
  [GLOB('/repo/media', '*.mp4')]: '/repo/media/clip.mp4\n',
  [GLOB('/repo/media', '*.txt')]: '',
}

const write = (content: string) => ({ tool: 'Write', file_path: '/repo/out.txt', content }) as const

test('big-file-guard: byte length counts UTF-8 bytes', () => {
  expect(byteLength('abc')).toBe(3)
  expect(byteLength('é')).toBe(2)
  expect(byteLength('€')).toBe(3)
  expect(WRITE_LIMIT).toBe(1024 * 1024)
})

test('big-file-guard: asks for a Write over 1 MB and passes up to it', async ($, on) => {
  const guard = probe($, on)
  expect(await guard.answeredTool(write('x'.repeat(WRITE_LIMIT + 1)))).toBe(true)
  expect(await guard.answeredTool(write('é'.repeat(600_000)))).toBe(true)
  expect(await guard.answeredTool(write('€'.repeat(349_526)))).toBe(true)
  expect(await guard.answeredTool(write('x'.repeat(WRITE_LIMIT)))).toBe(false)
  expect(await guard.answeredTool(write('€'.repeat(349_525)))).toBe(false)
  expect(await guard.answeredTool(write('hello'))).toBe(false)
  expect(await guard.answeredTool({ tool: 'Edit', file_path: '/repo/out.txt', old_string: 'a', new_string: 'x'.repeat(WRITE_LIMIT + 1) })).toBe(false)
})

test('big-file-guard: reads the paths git add names', () => {
  expect(addedPathsIn('git add a.txt b.txt', '/repo')).toEqual(['/repo/a.txt', '/repo/b.txt'])
  expect(addedPathsIn('git add -f -- -odd.txt /abs/x', '/repo')).toEqual(['/repo/-odd.txt', '/abs/x'])
  expect(addedPathsIn('git -C sub add big.bin && git commit -m x', '/repo')).toEqual(['/repo/sub/big.bin'])
  expect(addedPathsIn('git -C /other add x', '/repo')).toEqual(['/other/x'])
  expect(addedPathsIn('git add -A', '/repo')).toEqual([])
  expect(addedPathsIn('echo "git add big.bin"', '/repo')).toEqual([])
})

test('big-file-guard: asks when git add names a file over 5 MB', async ($, on) => {
  const guard = probe($, on, { fs: FS, git: SIZES })
  for (const command of ['git add big.bin', 'git add /repo/big.bin', 'git add -- big.bin', 'git add small.txt big.bin', 'git -C sub add big.bin', 'git add big.bin && git commit -m x']) {
    expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  }
})

test('big-file-guard: small files, folders, missing paths and other commands pass', async ($, on) => {
  const guard = probe($, on, { fs: FS, git: SIZES })
  for (const command of ['git add small.txt', 'git add .', 'git add -A', 'git add docs', 'git add gone.txt', 'git status', 'echo "git add big.bin"']) {
    expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
  }
})

test('big-file-guard: measures a glob in the last path segment', async ($, on) => {
  const guard = probe($, on, { fs: FS, git: SIZES })
  expect(await guard.answered('git add media/*.mp4')).toBe(true)
  expect(await guard.answered('git add media/*.txt')).toBe(false)
  expect(await guard.answered('git add gone/*.mp4')).toBe(false)
  // A glob in a folder name is not measured.
  expect(await guard.answered('git add */big.bin')).toBe(false)
})

test('big-file-guard: a size probe that fails asks', async ($, on) => {
  const failed = probe($, on, { fs: FS, git: SIZES })
  expect(await failed.answered('git add odd.bin')).toBe(true)
})

test('big-file-guard: a size probe cut at the output cap asks', async ($, on) => {
  const cut = probe($, on, { fs: FS, git: SIZES, truncated: [BIG('/repo/small.txt')] })
  expect(await cut.answered('git add small.txt')).toBe(true)
})
