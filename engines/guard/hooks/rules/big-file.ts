import type { GuardRule, GuardTools } from '../engine'
import { GIT_VALUE_FLAGS } from '../git'
import { base, commandsOf, subcommandOf } from '../shell'

// A big file bloats the context when Claude writes it and bloats the repo
// for good once git records it. Asks before a Write of more than 1 MiB of
// content, and before `git add` names a file of more than 5 MiB. Folders,
// `.`, `-A` and paths that do not exist (a staged deletion, a quoted
// pathspec) pass: only named files are measured.
export const WRITE_LIMIT = 1024 * 1024
const ADD_LIMIT = 5 * 1024 * 1024

export const byteLength = (text: string): number => new TextEncoder().encode(text).length

// Every UTF-16 unit is at least one byte and at most three.
const overWriteLimit = (content: string): boolean =>
  content.length > WRITE_LIMIT || (content.length * 3 > WRITE_LIMIT && byteLength(content) > WRITE_LIMIT)

const resolve = (path: string, dir: string): string => (path.startsWith('/') ? path : `${dir}/${path}`)

// `git -C a -C b` runs in a/b, as git does.
const dirOf = (globals: readonly string[], cwd: string): string =>
  globals.reduce((dir, word, i) => (globals[i - 1] === '-C' ? resolve(word, dir) : dir), cwd)

const pathArgs = (args: readonly string[]): readonly string[] => {
  const end = args.indexOf('--')
  const before = (end < 0 ? args : args.slice(0, end)).filter(arg => !arg.startsWith('-'))
  return end < 0 ? before : [...before, ...args.slice(end + 1)]
}

export const addedPathsIn = (command: string, cwd: string): readonly string[] =>
  commandsOf(command).flatMap(argv => {
    if (argv[0] === undefined || base(argv[0]) !== 'git') return []
    const { globals, sub, args } = subcommandOf(argv, GIT_VALUE_FLAGS)
    if (sub !== 'add') return []
    const dir = dirOf(globals, cwd)
    return pathArgs(args).map(path => resolve(path, dir))
  })

// find's `-size +Nc` counts exact bytes and reads the same on BSD and GNU.
// A probe that fails or is cut throws, and the engine asks.
const isBigFile = async (path: string, tools: GuardTools): Promise<boolean> => {
  if ((await tools.realPath(path)) === undefined) return false
  const ran = await tools.run(['find', path, '-maxdepth', '0', '-type', 'f', '-size', `+${ADD_LIMIT}c`], await tools.cwd())
  if (ran.exitCode !== 0 || ran.isStdoutTruncated) throw new Error(`cannot measure ${path}`)
  return ran.stdout.trim().length > 0
}

const bigAdds = async (command: string, tools: GuardTools): Promise<readonly string[]> => {
  const paths = [...new Set(addedPathsIn(command, await tools.cwd()))]
  const big = await Promise.all(paths.map(path => isBigFile(path, tools)))
  return paths.filter((_, i) => big[i])
}

export const rule: GuardRule = {
  id: 'big-file-guard',
  decision: 'ask',
  check: async (e, tools) => {
    if (e.tool === 'Write') {
      return overWriteLimit(e.content) ? `this writes more than 1 MB to ${e.file_path}. A file that size fills the context; a script can write it instead.` : undefined
    }
    if (e.tool !== 'Bash') return undefined
    const big = await bigAdds(e.command, tools)
    return big.length === 0 ? undefined : `git add names file(s) over 5 MB: ${big.join(' ')}. Git keeps them in history for good; consider Git LFS or .gitignore.`
  },
}
