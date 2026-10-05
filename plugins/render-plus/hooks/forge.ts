import { linkable } from './urls'

// The GitHub or GitLab project an `origin` remote names, and the commit and
// issue pages under it. Only the host and the project path are kept: a
// remote may carry a user and a token (`https://user:token@host/...`), and
// none of it ever reaches a drawing.

export type Forge = { host: 'github.com' | 'gitlab.com'; path: string }

// scp-like `git@host:path`, or a URL (`https://`, `ssh://`, `git://`) with an
// optional user and port; `.git` and a trailing slash dropped.
const REMOTE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/\s]+@)?([^/:\s]+)(?::\d+)?[:/](.+?)(?:\.git)?\/?$/i
const SEGMENT = /^[\w.-]+$/

export const forgeOf = (remote: string | null | undefined): Forge | undefined => {
  if (remote === null || remote === undefined) return undefined
  const found = REMOTE.exec(remote.trim())
  const host = found?.[1]?.toLowerCase()
  const parts = (found?.[2] ?? '').split('/')
  if (!parts.every(part => SEGMENT.test(part) && part !== '.' && part !== '..')) return undefined
  // GitHub is owner/name; GitLab nests groups, so two or more.
  if (host === 'github.com' && parts.length === 2) return { host, path: parts.join('/') }
  if (host === 'gitlab.com' && parts.length >= 2) return { host, path: parts.join('/') }
  return undefined
}

const pageOf = (forge: Forge, kind: 'commit' | 'issues', id: string): string | undefined =>
  linkable(`https://${forge.host}/${forge.path}/${forge.host === 'gitlab.com' ? '-/' : ''}${kind}/${id}`)

export const commitHref = (forge: Forge, sha: string): string | undefined => pageOf(forge, 'commit', sha)

export const issueHref = (forge: Forge, n: string): string | undefined => pageOf(forge, 'issues', n)

// The forge of the session's repository, read once per working directory: a
// reply is drawn again on every scroll and stream chunk, the remote stays.
export const forgeCache = (): ((cwd: string, read: () => Promise<{ remote: string | null } | null>) => Promise<Forge | undefined>) => {
  const known = new Map<string, Promise<Forge | undefined>>()
  return (cwd, read) => {
    const cached = known.get(cwd)
    if (cached !== undefined) return cached
    const asked = read().then(
      repo => forgeOf(repo?.remote),
      () => undefined,
    )
    known.set(cwd, asked)
    return asked
  }
}
