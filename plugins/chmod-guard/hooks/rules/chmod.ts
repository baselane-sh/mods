import type { GuardRule } from '../engine'
import { base, commandsOf, hasShortFlag } from '../shell'

// Permission changes that are hard to undo: a mode that lets every user
// write (777, a+w, o+w), and chmod or chown -R on a broad path. A broad path
// is /, a top-level folder, a home folder, or any folder two levels down
// outside /tmp (/usr/local, /Users/me). Project folders pass.
const OCTAL = /^[0-7]{1,4}$/
// A mode that starts with a dash (`-w`). No chmod option uses these letters.
const DASH_MODE = /^-[rwxXst]+$/
const OTHERS_WRITE = new Set(['2', '3', '6', '7'])
const HOME = /^(~[^/]*|\$HOME|\$\{HOME\})$/

const worldWritable = (mode: string): boolean => {
  if (OCTAL.test(mode)) return OTHERS_WRITE.has(mode.at(-1)!)
  return mode.split(',').some(clause => {
    const who = /^[ugoa]*/.exec(clause)![0]
    const grants = clause.slice(who.length).match(/[+=][^-+=]*/g) ?? []
    return /[ao]/.test(who) && grants.some(grant => grant.includes('w'))
  })
}

const isBroad = (path: string): boolean => {
  const trimmed = path.replace(/\/+$/, '') || (path.length > 0 ? '/' : '')
  if (trimmed === '/' || HOME.test(trimmed)) return true
  if (!trimmed.startsWith('/')) return false
  const names = trimmed.split('/').filter(name => name.length > 0)
  return names.length === 1 || (names.length === 2 && names[0] !== 'tmp')
}

const isRecursive = (word: string): boolean => word === '--recursive' || hasShortFlag(word, 'R')

// chmod and chown share one shape: options, then a mode or an owner, then
// the paths.
const dangersOf = (name: string, args: readonly string[]): string[] => {
  const [lead, ...paths] = args.filter(arg => !arg.startsWith('-') || (name === 'chmod' && DASH_MODE.test(arg)))
  if (lead === undefined) return []
  const open = name === 'chmod' && worldWritable(lead) ? [`world-writable chmod ${lead}`] : []
  const broad = args.some(isRecursive) ? paths.filter(isBroad).map(path => `recursive ${name} on ${path}`) : []
  return [...open, ...broad]
}

export const chmodDangersIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => {
    const name = argv[0] === undefined ? undefined : base(argv[0])
    return name === 'chmod' || name === 'chown' ? dangersOf(name, argv.slice(1)) : []
  })
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'chmod-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = chmodDangersIn(e.command)
    return found.length === 0 ? undefined : `this changes permissions in a way that is hard to undo (${found.join(', ')}).`
  },
}
