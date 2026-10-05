import type { RenderRule } from '../engine'

// Long absolute paths on tool rows are drawn shorter: the project root as
// `./`, the home folder as `~`. Only the path fields of a row's input change,
// and only in the drawing; a Bash command is drawn as it ran.

// Paths this long or shorter are drawn as they are.
export const MIN_LENGTH = 40
const FIELDS = ['file_path', 'notebook_path', 'path'] as const

const under = (path: string, base: string | undefined): string | undefined => {
  if (base === undefined) return undefined
  const dir = base.replace(/\/+$/, '')
  // A root of `/` would turn every path into one under it.
  if (dir.length === 0 || !path.startsWith(`${dir}/`)) return undefined
  return path.slice(dir.length + 1)
}

// The project root wins over home: it is the longer, nearer match.
export const shortenPath = (path: string, root: string | undefined, home: string | undefined): string => {
  const inRoot = under(path, root)
  if (inRoot !== undefined) return `./${inRoot}`
  const inHome = under(path, home)
  return inHome === undefined ? path : `~/${inHome}`
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const isLong = (value: unknown): value is string => typeof value === 'string' && value.startsWith('/') && value.length > MIN_LENGTH

export const create = (): RenderRule => {
  // The home folder does not move in a session; asked once per load.
  let home: Promise<string | undefined> | undefined

  return {
    id: 'path-shorten',
    toolRow: {
      tools: 'all',
      rewrite: async ({ props, home: readHome, root: readRoot }) => {
        const input = props.input
        if (!isRecord(input) || !FIELDS.some(field => isLong(input[field]))) return undefined
        home ??= readHome().catch(() => undefined)
        const [homeDir, rootDir] = await Promise.all([home, readRoot().catch(() => undefined)])
        const changed = Object.fromEntries(
          FIELDS.flatMap(field => {
            const value = input[field]
            if (!isLong(value)) return []
            const short = shortenPath(value, rootDir, homeDir)
            return short === value ? [] : [[field, short]]
          }),
        )
        return Object.keys(changed).length === 0 ? undefined : { ...props, input: { ...input, ...changed } }
      },
    },
  }
}
