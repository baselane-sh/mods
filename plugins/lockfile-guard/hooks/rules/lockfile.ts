import type { GuardRule } from '../engine'

// A lockfile is the package manager's record. Edited by hand it drifts from
// the manifest and hides what was really installed.
const LOCKFILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
  'Cargo.lock',
  'poetry.lock',
  'uv.lock',
  'Pipfile.lock',
  'Gemfile.lock',
  'go.sum',
  'composer.lock',
])
const WATCHED = new Set<string>(['Write', 'Edit'])

const nameOf = (path: string): string => path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)

export const isLockfile = (path: string): boolean => LOCKFILES.has(nameOf(path))

export const rule: GuardRule = {
  id: 'lockfile-guard',
  decision: 'ask',
  check: e => {
    if (!WATCHED.has(String(e.tool)) || !('file_path' in e) || typeof e.file_path !== 'string') return undefined
    return isLockfile(e.file_path)
      ? `${nameOf(e.file_path)} is a lockfile. It should change only through the package manager (install, add, remove, update), not by hand.`
      : undefined
  },
}
