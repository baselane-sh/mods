import type { CommandRule, CommandTools, Composed } from '../engine'
import { bullets, finish, isRepo, lines, message, notARepo } from '../helpers'

const STALE_DAYS = 30
const MAX_PER_LIST = 50
const DAY_MS = 86_400_000

type Branch = { name: string; at: number }

// "feat/x 1700000000" becomes a branch. A row that is not that is dropped.
const parse = (row: string): Branch | undefined => {
  const cut = row.lastIndexOf(' ')
  const at = Number(row.slice(cut + 1))
  return cut < 1 || !Number.isFinite(at) ? undefined : { name: row.slice(0, cut), at }
}

// origin/HEAD when the remote sets it, then main, then master.
const findDefault = async (tools: CommandTools): Promise<string | undefined> => {
  const head = (await tools.git('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'))?.trim()
  const fromRemote = head === undefined || head === '' ? [] : [head.replace(/^origin\//, '')]
  for (const name of [...fromRemote, 'main', 'master']) {
    if ((await tools.git('rev-parse', '--verify', '--quiet', name)) !== undefined) return name
  }
  return undefined
}

const section = (title: string, rows: readonly string[]): string[] => [`${title} (${rows.length})`, ...bullets(rows, MAX_PER_LIST), '']

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const all = lines(await tools.git('for-each-ref', 'refs/heads', '--format=%(refname:short) %(committerdate:unix)'))
    .map(parse)
    .filter((b): b is Branch => b !== undefined)
  if (all.length === 0) return message('No local branches yet.')
  const def = await findDefault(tools)
  if (def === undefined) return message('No main or master branch found, so there is nothing to compare against.')

  const current = ((await tools.git('rev-parse', '--abbrev-ref', 'HEAD')) ?? '').trim()
  const keep = (name: string): boolean => name !== def && name !== current
  const merged = lines(await tools.git('branch', '--merged', def, '--format=%(refname:short)')).filter(keep)
  const now = Date.now()
  const stale = all
    .filter(b => keep(b.name) && !merged.includes(b.name) && now - b.at * 1000 > STALE_DAYS * DAY_MS)
    .map(b => `${b.name} (${Math.floor((now - b.at * 1000) / DAY_MS)} days ago)`)
  if (merged.length === 0 && stale.length === 0) return message(`Nothing to clean up: no merged or stale branches besides ${def}.`)

  return finish(
    [
      ...(merged.length === 0 ? [] : section(`Merged into ${def}`, merged)),
      ...(stale.length === 0 ? [] : section(`No commit in ${STALE_DAYS} days`, stale)),
      'Nothing was deleted. This list is read-only.',
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'branches',
  description: 'List local branches merged into the default branch or idle for 30 days, as a cleanup list (never deletes)',
  compose,
}
