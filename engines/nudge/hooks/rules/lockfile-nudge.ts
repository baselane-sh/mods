import type { Nudge } from '../engine'
import { basename, changedLines, dirname, fileEdit, inCommand, ranOk } from '../edits'

type Ecosystem = 'node' | 'python' | 'rust' | 'go'

const MANIFESTS: Readonly<Record<string, Ecosystem>> = {
  'package.json': 'node', 'pyproject.toml': 'python', 'Cargo.toml': 'rust', 'go.mod': 'go',
}

const LOCKFILES: Readonly<Record<string, Ecosystem>> = {
  'package-lock.json': 'node', 'npm-shrinkwrap.json': 'node', 'pnpm-lock.yaml': 'node', 'yarn.lock': 'node', 'bun.lock': 'node', 'bun.lockb': 'node',
  'uv.lock': 'python', 'poetry.lock': 'python', 'pdm.lock': 'python',
  'Cargo.lock': 'rust',
  'go.sum': 'go',
}

// Does a changed line declare a dependency? Version, name and engine lines
// are not dependencies, so bumping them needs no lockfile.
const NODE_VERSION = /^(?:[\^~<>=]*\s*\d|\*$|latest$|next$|workspace:|npm:|file:|link:|git|github:|https?:)/
const nodeDependency = (line: string): boolean => {
  if (/"(dev|peer|optional)?[dD]ependencies"\s*:/.test(line)) return true
  const pair = /^\s*"([^"]+)"\s*:\s*"([^"]*)"/.exec(line)
  return pair !== undefined && pair !== null && !/^(version|node|npm|pnpm|yarn|bun|vscode)$/.test(pair[1] ?? '') && NODE_VERSION.test(pair[2] ?? '')
}

const DEPENDENCY: Readonly<Record<Ecosystem, (line: string) => boolean>> = {
  node: nodeDependency,
  // A PEP 508 string in a dependencies array, or a poetry "name = version" line.
  python: line => /^\s*["'][A-Za-z][\w.-]*(\[[\w,.-]+\])?\s*([<>=~!]=?\s*[\w.*]+.*)?["'],?\s*$/.test(line) || /^\s*(?!version\b|name\b|python\b)[A-Za-z][\w.-]*\s*=\s*("[\^~<>=*]?\d|\{[^}]*\bversion\b)/.test(line),
  rust: line => /^\s*\[(dev-|build-|workspace\.)?dependencies(\.[\w-]+)?\]/.test(line) || /^\s*(?!version\b|edition\b|rust-version\b)[\w-]+\s*=\s*("[\^~=<>*]?\d|\{[^}]*\b(version|path|git|workspace)\b)/.test(line),
  go: line => /^\s*(require\s+)?[\w.-]+\.[a-z]{2,}\/\S+\s+v\d/.test(line),
}

const INSTALL: Readonly<Record<Ecosystem, RegExp>> = {
  node: new RegExp(`${inCommand('(npm|pnpm|bun) +(install|i|add|ci|remove|rm|uninstall|update|up|upgrade)|yarn +(install|add|remove|upgrade|up)').source}|(^|[;&|] *)yarn *($|[;&|])`, 'm'),
  python: inCommand('uv +(sync|lock|add|remove|pip +install)|poetry +(lock|install|add|remove|update)|pdm +(lock|install|add|remove|sync|update)|pip3? +install'),
  rust: inCommand('cargo +(add|remove|update|build|check|generate-lockfile|fetch)'),
  go: inCommand('go +(mod +(tidy|download)|get)'),
}

const NAMED = 3

// One turn-end toast when a manifest's dependencies changed and neither its
// lockfile (same folder) was edited nor a successful install ran after.
export const create = (): Nudge => {
  let pending: readonly { path: string; ecosystem: Ecosystem }[] = []

  const settle = (keep: (entry: { path: string; ecosystem: Ecosystem }) => boolean): void => {
    pending = pending.filter(keep)
  }

  return {
    id: 'lockfile-nudge',
    observe: (e, ran) => {
      const edit = fileEdit(e, ran)
      if (edit !== undefined) {
        const name = basename(edit.path)
        const lock = LOCKFILES[name]
        if (lock !== undefined) settle(entry => !(entry.ecosystem === lock && dirname(entry.path) === dirname(edit.path)))
        const ecosystem = MANIFESTS[name]
        const { added, removed } = changedLines(edit)
        if (ecosystem !== undefined && [...added, ...removed].some(DEPENDENCY[ecosystem])) {
          pending = [...pending.filter(entry => entry.path !== edit.path), { path: edit.path, ecosystem }]
        }
      }
      if (e.tool === 'Bash' && ranOk(ran)) {
        const installed = (Object.keys(INSTALL) as Ecosystem[]).filter(ecosystem => INSTALL[ecosystem].test(e.command))
        settle(entry => !installed.includes(entry.ecosystem))
      }
    },
    atStop: () => {
      if (pending.length === 0) return undefined
      const names = pending.map(entry => entry.path)
      pending = [] // one toast per batch of edits
      const shown = names.slice(0, NAMED).join(', ')
      return `${shown}${names.length > NAMED ? ` and ${names.length - NAMED} more` : ''} dependencies changed but no lockfile update or install ran. Run the install command.`
    },
  }
}
