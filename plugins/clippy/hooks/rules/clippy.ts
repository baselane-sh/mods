import type { Nudge } from '../engine'

type Trigger = 'migration' | 'dockerfile' | 'workflow' | 'rm-rf'

// The classic paperclip: it looks like you're doing X, want help? Each line
// is a comment, never a block: the guard decides about rm -rf, clippy only talks.
export const LINES: Readonly<Record<Trigger, string>> = {
  migration: "It looks like you're writing a migration. Want me to remind you to back up first?",
  dockerfile:
    "It looks like you're editing a Dockerfile. Would you like me to remind you to pin the base image and keep secrets out of the layers?",
  workflow:
    "It looks like you're editing a GitHub Actions workflow. Want a tip? Pin third-party actions to a commit SHA and give the job the least permissions it needs.",
  'rm-rf':
    "It looks like you're deleting files with rm -rf. Want me to point out that there is no undo? The guard will ask anyway; I'm just a paperclip.",
}

const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

const pathTrigger = (path: string): Trigger | undefined => {
  const parts = path.split('/')
  const name = parts.at(-1) ?? ''
  if (/^dockerfile(\..+)?$/i.test(name) || /\.dockerfile$/i.test(name)) return 'dockerfile'
  if (/(^|\/)\.github\/workflows\/./.test(path)) return 'workflow'
  if (parts.slice(0, -1).some(part => part.toLowerCase() === 'migrations')) return 'migration'
  return undefined
}

// `rm` in command position with both a recursive and a force flag, in any
// spelling (-rf, -fr, -Rf, -r -f, --recursive --force). `git rm` and the word
// in an argument do not count.
export const isRmRf = (command: string): boolean =>
  command.split(/[;&|\n]+/).some(part => {
    const words = part.trim().split(/\s+/)
    const start = words[0] === 'sudo' ? 1 : 0
    if (words[start] !== 'rm') return false
    const flags = words.slice(start + 1).filter(word => word.startsWith('-'))
    const short = flags.filter(flag => !flag.startsWith('--')).join('')
    const isRecursive = /[rR]/.test(short) || flags.includes('--recursive')
    const isForce = /f/.test(short) || flags.includes('--force')
    return isRecursive && isForce
  })

const triggerOf = (e: Parameters<NonNullable<Nudge['observe']>>[0]): Trigger | undefined => {
  if (FILE_TOOLS.has(e.tool)) {
    const path = 'file_path' in e ? e.file_path : 'notebook_path' in e ? e.notebook_path : undefined
    return typeof path === 'string' ? pathTrigger(path) : undefined
  }
  return e.tool === 'Bash' && isRmRf(e.command) ? 'rm-rf' : undefined
}

// One toast per session per trigger. At most one per turn (a stop): when
// several triggers fire in one turn the first speaks and the rest wait, in
// order, for the next turn's stop.
export const create = (): Nudge => {
  const spoken = new Set<Trigger>()
  let waiting: readonly Trigger[] = []

  return {
    id: 'clippy',
    observe: e => {
      const trigger = triggerOf(e)
      if (trigger !== undefined && !spoken.has(trigger) && !waiting.includes(trigger)) waiting = [...waiting, trigger]
    },
    atStop: () => {
      const [next, ...rest] = waiting
      if (next === undefined) return undefined
      waiting = rest
      spoken.add(next)
      return LINES[next]
    },
  }
}
