import type { GuardRule } from '../engine'

// CI config runs with the repo's deploy keys and secrets, on every push. A
// change to it is a change to what CI may do, so it gets a second look.
// Only Write and Edit are watched; a shell command that edits the file
// passes.
const WATCHED = new Set<string>(['Write', 'Edit'])

const namesOf = (path: string): readonly string[] => path.replace(/\\/g, '/').split('/').filter(name => name.length > 0)

export const isCiConfig = (path: string): boolean => {
  const names = namesOf(path)
  const last = names.at(-1)
  const workflows = names.findIndex((name, i) => name === '.github' && names[i + 1] === 'workflows')
  return (
    (workflows >= 0 && workflows + 2 < names.length) ||
    last === '.gitlab-ci.yml' ||
    (last === 'config.yml' && names.at(-2) === '.circleci')
  )
}

export const rule: GuardRule = {
  id: 'ci-config-guard',
  decision: 'ask',
  check: e => {
    if (!WATCHED.has(String(e.tool)) || !('file_path' in e) || typeof e.file_path !== 'string') return undefined
    return isCiConfig(e.file_path)
      ? `${e.file_path} is CI config. It runs with the repo's secrets and deploy rights on every push.`
      : undefined
  },
}
