import type { GuardRule } from '../engine'
import { base, hasShortFlag, segmentsOf, withoutSudo } from '../shell'

// Local files on their way to another host. Downloads, local copies and
// anything aimed at this machine pass. env-exfil-guard also asks on curl
// uploads and piped nc; the first guard that asks answers for the rest, so
// the person sees one dialog.
const SCP_VALUE_FLAGS = new Set(['-c', '-F', '-i', '-J', '-l', '-o', '-P', '-S', '-D', '-X'])
const RSYNC_VALUE_FLAGS = new Set([
  '-e', '--rsh', '--exclude', '--include', '--exclude-from', '--include-from', '--files-from', '--filter', '-f',
  '--port', '--password-file', '--log-file', '--chmod', '--chown', '--rsync-path', '-B', '--block-size', '--bwlimit',
  '--max-size', '--min-size', '--partial-dir', '--temp-dir', '-T', '--link-dest', '--compare-dest', '--copy-dest',
  '--backup-dir', '--suffix', '--timeout', '--contimeout', '-M', '--remote-option', '--out-format', '--info', '--debug',
])
const NC_VALUE_FLAGS = new Set(['-p', '-s', '-w', '-i', '-x', '-X', '-q', '-O', '-I', '-T', '-V'])
const NC_NAMES = new Set(['nc', 'ncat', 'netcat'])
const LOCAL_HOST = /^(localhost|127\.[0-9.]+|0\.0\.0\.0|\[?::1\]?)$/
const LOCAL_URL = /^[a-z]+:\/\/(localhost|127\.[0-9.]+|0\.0\.0\.0|\[::1\])([:/]|$)/i
const SFTP_PUT = /\b(put|mput|reput)\b/

// The words that are neither options nor an option's value.
const positionals = (args: readonly string[], valueFlags: ReadonlySet<string>): readonly string[] =>
  args.reduce<{ out: readonly string[]; skip: boolean }>(
    ({ out, skip }, arg) => {
      if (skip) return { out, skip: false }
      return arg.startsWith('-') ? { out, skip: valueFlags.has(arg) } : { out: [...out, arg], skip: false }
    },
    { out: [], skip: false },
  ).out

// The host of an scp or rsync remote spec (`user@host:path`, `host::module`,
// `rsync://host/x`), or undefined for a local path.
const remoteHost = (spec: string): string | undefined => {
  const url = /^(?:rsync|scp|sftp):\/\/(?:[^@/]+@)?([^/:]+)/.exec(spec)
  if (url !== null) return url[1]
  const colon = spec.indexOf(':')
  if (colon <= 0 || spec.slice(0, colon).includes('/')) return undefined
  const host = spec.slice(0, colon).replace(/^.*@/, '')
  return host.length === 0 || LOCAL_HOST.test(host) ? undefined : host
}

// scp and rsync copy to the last path; it is an upload when that path is
// remote and some source is local.
const copyUpload = (name: string, args: readonly string[]): string | undefined => {
  const paths = positionals(args, name === 'scp' ? SCP_VALUE_FLAGS : RSYNC_VALUE_FLAGS)
  const target = paths[paths.length - 1]
  const host = target === undefined ? undefined : remoteHost(target)
  const hasLocalSource = paths.slice(0, -1).some(path => remoteHost(path) === undefined && !/^[a-z]+:\/\//.test(path))
  return host !== undefined && hasLocalSource ? `${name} to ${host}` : undefined
}

const ncUpload = (args: readonly string[], piped: boolean): string | undefined => {
  if (args.some(arg => hasShortFlag(arg, 'l') || hasShortFlag(arg, 'z'))) return undefined
  const [host] = positionals(args.filter(arg => !arg.startsWith('<')), NC_VALUE_FLAGS)
  const hasInput = piped || args.some(arg => arg.startsWith('<'))
  return host !== undefined && !LOCAL_HOST.test(host) && hasInput ? `nc to ${host}` : undefined
}

const curlUpload = (args: readonly string[]): string | undefined => {
  const uploads = args.some(arg => arg === '--upload-file' || arg.startsWith('--upload-file=') || hasShortFlag(arg, 'T') || /^-T./.test(arg))
  const urls = args.filter(arg => /^[a-z]+:\/\//i.test(arg))
  const isLocal = urls.length > 0 && urls.every(url => LOCAL_URL.test(url))
  return uploads && !isLocal ? 'curl --upload-file' : undefined
}

export const uploadsIn = (command: string): readonly string[] => {
  const segments = segmentsOf(command)
  const found = segments.flatMap((segment, index) => {
    const argv = withoutSudo(segment.argv)
    const name = argv[0] === undefined ? '' : base(argv[0])
    const args = argv.slice(1)
    const piped = index > 0 && segments[index - 1]?.pipeline === segment.pipeline
    const upload =
      name === 'scp' || name === 'rsync' ? copyUpload(name, args)
      : NC_NAMES.has(name) ? ncUpload(args, piped)
      : name === 'curl' ? curlUpload(args)
      : name === 'sftp' && SFTP_PUT.test(command) ? 'sftp put'
      : undefined
    return upload === undefined ? [] : [upload]
  })
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'upload-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = uploadsIn(e.command)
    return found.length === 0 ? undefined : `this sends local files to a remote host (${found.join(', ')}). Check the files hold nothing private and the host is the one you mean.`
  },
}
