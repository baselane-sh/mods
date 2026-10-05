import type { NudgeTools } from './engine'

// A read of bd as JSON. Anything but a clean answer (bd missing, no beads
// project, a timeout, empty output, text that is not JSON) is `undefined`, so
// a nudge stays quiet. Never retried.
export const bdJson = async (tools: NudgeTools, args: readonly string[], cwd: string): Promise<unknown> => {
  try {
    const done = await tools.run(['bd', ...args, '--json'], cwd)
    if (done.exitCode !== 0 || done.stdout.trim() === '') return undefined
    return JSON.parse(done.stdout) as unknown
  } catch {
    return undefined
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

// How many beads are in progress here, or undefined when bd cannot say.
export const inProgressCount = async (tools: NudgeTools, cwd: string): Promise<number | undefined> => {
  const answer = await bdJson(tools, ['count', '--status', 'in_progress'], cwd)
  const count = isRecord(answer) ? answer['count'] : undefined
  return typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : undefined
}

const PREFIX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,30}$/

// The id prefix of this repo's beads (`bm` for `bm-ooq.64`), or undefined.
export const beadPrefix = async (tools: NudgeTools, cwd: string): Promise<string | undefined> => {
  const answer = await bdJson(tools, ['where'], cwd)
  const prefix = isRecord(answer) ? answer['prefix'] : undefined
  return typeof prefix === 'string' && PREFIX.test(prefix) ? prefix : undefined
}

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// True when the text names a bead id: `<prefix>-abc`, `<prefix>-abc.12.3`.
export const namesBead = (text: string, prefix: string): boolean =>
  new RegExp(`(^|[^A-Za-z0-9_-])${escaped(prefix)}-[a-z0-9]+(\\.[0-9]+)*`).test(text)
