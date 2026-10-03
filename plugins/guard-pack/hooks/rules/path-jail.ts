import type { GuardRule, GuardTools } from '../engine'

// Asks before a file tool writes outside the session's working directory.
// Paths are compared by where they really land (symbolic links followed), so
// `../x`, a link into /etc and a spelling like `src/../../x` cannot slip
// through. A file that does not exist yet lands where its nearest existing
// parent does.
//
// One allowance: Claude Code's own per-user scratch area, /tmp/claude-<uid>
// (the session scratchpad and bundled skills live there). It is made for the
// session, holds nothing of the user's, and a rule that asked for every
// scratch file would be switched off. The rest of /tmp still asks.
const FIELD: Readonly<Record<string, string>> = { Write: 'file_path', Edit: 'file_path', NotebookEdit: 'notebook_path' }
const SCRATCH = /^\/(?:private\/)?tmp\/claude-\d+(?:\/|$)/
// `~` and Windows drive or share spellings cannot be placed without a shell.
const UNPLACEABLE = /^(?:~|[A-Za-z]:|\\\\)/

const targetOf = (e: Parameters<GuardRule['check']>[0]): string | undefined => {
  const field = FIELD[String(e.tool)]
  const value = field === undefined ? undefined : Object.entries(e).find(([key]) => key === field)?.[1]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

// The path's segments with `.` and `..` folded away.
const fold = (path: string): readonly string[] =>
  path.split('/').reduce<string[]>((kept, name) => {
    if (name === '' || name === '.') return kept
    return name === '..' ? kept.slice(0, -1) : [...kept, name]
  }, [])

const join = (real: string, names: readonly string[]): string => [real.replace(/\/$/, ''), ...names].join('/')

const placed = async (path: string, realPath: GuardTools['realPath']): Promise<string | undefined> => {
  const own = await realPath(path)
  if (own !== undefined) return own
  const names = fold(path)
  for (let keep = names.length; keep >= 0; keep -= 1) {
    const real = await realPath(`/${names.slice(0, keep).join('/')}`)
    if (real !== undefined) return join(real, names.slice(keep))
  }
  return undefined
}

const isUnder = (real: string, root: string): boolean => root === '/' || real === root || real.startsWith(`${root}/`)

export const rule: GuardRule = {
  id: 'path-jail',
  decision: 'ask',
  check: async (e, tools) => {
    const target = targetOf(e)
    if (target === undefined) return undefined
    const cwd = await tools.cwd()
    const root = await tools.realPath(cwd)
    const real = UNPLACEABLE.test(target) ? undefined : await placed(target.startsWith('/') ? target : `${cwd}/${target}`, tools.realPath)
    if (root === undefined || real === undefined) {
      return `cannot tell where ${target} lands, so it counts as outside the working directory.`
    }
    if (isUnder(real, root) || SCRATCH.test(real)) return undefined
    return `${target} lands at ${real}, outside the working directory ${root}.`
  },
}
