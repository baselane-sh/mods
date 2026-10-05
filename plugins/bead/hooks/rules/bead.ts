import { asBeads, bd, BEAD_ID, clip, NO_ANSWER } from '../beads'
import type { Bead } from '../beads'
import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, message } from '../helpers'

const USAGE = 'Usage: /bead <id>, for example /bead bm-ooq.64'
const DESCRIPTION_LINES = 15
const LIST_CAP = 20

const linked = (title: string, beads: readonly Bead[]): string[] =>
  beads.length === 0
    ? []
    : [
        '',
        `${title} (${beads.length})`,
        ...beads.slice(0, LIST_CAP).map(b => `  ${b.id}  ${b.status}  ${clip(b.title, 60)}`),
        ...(beads.length > LIST_CAP ? [`  +${beads.length - LIST_CAP} more`] : []),
      ]

const describe = (b: Bead): string[] => {
  const lines = (b.description ?? '').split('\n')
  const shown = lines.slice(0, DESCRIPTION_LINES).map(line => line.trimEnd())
  return lines.length > DESCRIPTION_LINES ? [...shown, `... (${lines.length - DESCRIPTION_LINES} more lines)`] : shown
}

const one = async (tools: CommandTools, ...args: string[]): Promise<{ beads: Bead[] } | { text: string }> => {
  const answer = await bd(tools, ...args)
  if (!answer.ok) return { text: answer.text }
  const beads = asBeads(answer.json)
  return beads === undefined ? { text: NO_ANSWER } : { beads }
}

// `bd show` writes .beads/last-touched, and a later bare `bd close` would act
// on that bead. `bd list` does not, so every read here is a list.
const compose = async (_record: unknown, _facts: unknown, tools: CommandTools, args: string): Promise<Composed> => {
  // One id, checked before bd runs, so it can never be read as an option.
  if (!BEAD_ID.test(args)) return message(USAGE)
  const own = await one(tools, 'list', '--id', args, '--all', '--json')
  if ('text' in own) return message(own.text)
  // An id that is not there is an empty list with exit 0.
  const found = own.beads[0]
  if (found === undefined) return message(`No bead ${args} in this project.`)

  const kids = await one(tools, 'list', '--parent', args, '--status', 'all', '--json', '-n', '0')
  if ('text' in kids) return message(kids.text)
  const blockerIds = (found.dependencies ?? []).filter(d => d.type === 'blocks').map(d => d.depends_on_id)
  const blockers = blockerIds.length === 0 ? { beads: [] } : await one(tools, 'list', '--id', blockerIds.join(','), '--all', '--json')
  if ('text' in blockers) return message(blockers.text)

  const head = [
    `${found.id}  ${clip(found.title, 120)}`,
    `status: ${found.status}`,
    `priority: P${found.priority ?? '?'}`,
    `type: ${found.issue_type ?? 'unknown'}`,
    `parent: ${found.parent ?? 'none'}`,
    `labels: ${(found.labels ?? []).join(', ') || 'none'}`,
  ]
  const text = [...head, '', ...describe(found), ...linked('Blocked by', blockers.beads), ...linked('Children', kids.beads)]
  return message(finish(text.join('\n')))
}

export const rule: CommandRule = {
  name: 'bead',
  description: 'Show one bead by id (fields, description, blockers, children), read with bd (read-only, not copied)',
  compose,
}
