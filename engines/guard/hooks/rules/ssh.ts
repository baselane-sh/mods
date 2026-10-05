import type { GuardRule, GuardTools } from '../engine'
import { base, commandsOf } from '../shell'

// SSH keys and the files that grant SSH access. Asks when a command reads a
// private key (id_* in a .ssh folder, not .pub), when anything changes
// authorized_keys or the SSH config, and when ssh-keygen would write over a
// key that exists. Using a key (ssh -i, ssh-add, chmod) passes, and so do
// public keys and reads of the config. secret-filename-guard asks on any
// command naming id_rsa, .pub included; this rule is the precise one and
// also covers the file tools.
const KEY_USERS = new Set(['ssh', 'ssh-add', 'ssh-copy-id', 'ssh-keygen', 'chmod', 'chown', 'ls', 'stat', 'test', '[', 'file', 'echo', 'printf'])
const IDENTITY_TAKERS = new Set(['scp', 'sftp'])
const COPIES = new Set(['cp', 'mv', 'install', 'ln', 'rsync', 'ditto'])
const IN_PLACE = new Set(['sed', 'gsed', 'perl'])
const REMOVES = new Set(['rm', 'unlink', 'shred', 'truncate'])
const REDIRECT = /^(\d*|&)(>>?|<)\|?$/
const ATTACHED = /^(\d*|&)(>>?|<)\|?(.+)$/

export const isPrivateKey = (path: string): boolean => !/\s/.test(path) && /(^|\/)\.ssh\/id_[^/]*$/.test(path) && !path.endsWith('.pub')
export const isAccessFile = (path: string): boolean => /(^|\/)\.ssh\/(authorized_keys2?|config)$/.test(path)

// A word of a command: an argument, or the file a redirect reads or writes.
type Word = { path: string; via: 'arg' | 'in' | 'out'; afterIdentity: boolean }

const wordsOf = (args: readonly string[]): readonly Word[] =>
  args.flatMap((arg, i): Word[] => {
    if (REDIRECT.test(args[i - 1] ?? '')) return []
    const op = REDIRECT.exec(arg) ?? ATTACHED.exec(arg)
    const path = op === null ? arg : op[3] ?? args[i + 1]
    if (path === undefined) return []
    const via = op === null ? 'arg' : op[2] === '<' ? 'in' : 'out'
    return [{ path: path.replace(/^of=/, ''), via, afterIdentity: args[i - 1] === '-i' }]
  })

const keyDanger = (name: string, word: Word): string | undefined => {
  if (!isPrivateKey(word.path)) return undefined
  if (word.via === 'out' || REMOVES.has(name)) return `change private key ${word.path}`
  const isUse = word.via === 'arg' && (KEY_USERS.has(name) || (IDENTITY_TAKERS.has(name) && word.afterIdentity))
  return isUse ? undefined : `read private key ${word.path}`
}

const accessDanger = (name: string, args: readonly string[], word: Word, last: string | undefined): string | undefined => {
  if (!isAccessFile(word.path)) return undefined
  const inPlace = IN_PLACE.has(name) && args.some(arg => arg.startsWith('--in-place') || /^-[a-zA-Z]*i/.test(arg))
  const writes =
    word.via === 'out' || name === 'tee' || name === 'dd' || REMOVES.has(name) || inPlace || (COPIES.has(name) && word.path === last)
  return writes ? `change ${word.path}` : undefined
}

export const sshDangersIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => {
    const name = argv[0] === undefined ? '' : base(argv[0])
    const args = argv.slice(1)
    const words = wordsOf(args)
    const last = words.filter(word => word.via === 'arg' && !word.path.startsWith('-')).at(-1)?.path
    return words.flatMap(word => [keyDanger(name, word), accessDanger(name, args, word, last)].filter((d): d is string => d !== undefined))
  })
  return [...new Set(found)]
}

// ssh-keygen options, read the way its getopt reads them: these take a value,
// and these pick a mode other than making a new key (list, print, convert,
// change a passphrase, sign, search known_hosts and so on).
const KEYGEN_VALUE = new Set('CDEFGIJMNOPRSTVWYZabfjmnrstwz')
const KEYGEN_MODES = new Set('ABHKLQceiklpyDFGMRTrsY')

const keygenFlags = (args: readonly string[]): ReadonlyMap<string, string> => {
  const flags = new Map<string, string>()
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!
    if (!arg.startsWith('-') || arg === '-' || arg === '--') continue
    for (let j = 1; j < arg.length; j += 1) {
      const letter = arg[j]!
      if (!KEYGEN_VALUE.has(letter)) {
        flags.set(letter, '')
        continue
      }
      const attached = arg.slice(j + 1)
      flags.set(letter, attached !== '' ? attached : args[i + 1] ?? '')
      if (attached === '') i += 1
      break
    }
  }
  return flags
}

// The key files each ssh-keygen in the command would write: -f, or the
// default for the key type (ed25519 when -t is absent, as in OpenSSH 9.5+).
export const keygenTargetsIn = (command: string): readonly string[] =>
  commandsOf(command)
    .filter(argv => argv[0] !== undefined && base(argv[0]) === 'ssh-keygen')
    .flatMap(argv => {
      const flags = keygenFlags(argv.slice(1))
      if ([...flags.keys()].some(letter => KEYGEN_MODES.has(letter))) return []
      const type = (flags.get('t') ?? 'ed25519').replace('-', '_')
      return [flags.get('f') ?? `~/.ssh/id_${type}`]
    })

const HOME_PREFIX = /^(~|\$HOME|\$\{HOME\})(?=\/|$)/

// `~` and $HOME need the real home folder; the engine asks if HOME is unset.
const placed = async (path: string, tools: GuardTools): Promise<string> => {
  const cwd = await tools.cwd()
  if (!HOME_PREFIX.test(path)) return path.startsWith('/') ? path : `${cwd}/${path}`
  const ran = await tools.run(['printenv', 'HOME'], cwd)
  const home = ran.stdout.trim()
  if (ran.exitCode !== 0 || home === '') throw new Error('HOME is not set')
  return path.replace(HOME_PREFIX, home)
}

const overwrites = async (command: string, tools: GuardTools): Promise<readonly string[]> => {
  const targets = keygenTargetsIn(command)
  const found = await Promise.all(
    targets.map(async target => ((await tools.realPath(await placed(target, tools))) === undefined ? [] : [`ssh-keygen overwrites ${target}`])),
  )
  return found.flat()
}

// The file tools: Read of a private key, Write or Edit of a key or an access file.
const fileDanger = (e: Parameters<GuardRule['check']>[0]): string | undefined => {
  const value = Object.entries(e).find(([key]) => key === 'file_path')?.[1]
  if (typeof value !== 'string') return undefined
  if (e.tool === 'Read') return isPrivateKey(value) ? `read private key ${value}` : undefined
  const isWrite = e.tool === 'Write' || e.tool === 'Edit' || String(e.tool) === 'MultiEdit'
  return isWrite && (isPrivateKey(value) || isAccessFile(value)) ? `change ${value}` : undefined
}

export const rule: GuardRule = {
  id: 'ssh-guard',
  decision: 'ask',
  check: async (e, tools) => {
    const found = e.tool === 'Bash' ? [...sshDangersIn(e.command), ...(await overwrites(e.command, tools))] : [fileDanger(e)].filter((d): d is string => d !== undefined)
    return found.length === 0 ? undefined : `this touches SSH keys or SSH access (${found.join(', ')}). A leaked key gives others your access; a changed authorized_keys or config can let someone in or lock you out.`
  },
}
