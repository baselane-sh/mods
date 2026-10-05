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

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools, args: string): Promise<Composed> => {
  // One id, checked before bd runs, so it can never be read as an option.
  if (!BEAD_ID.test(args)) return message(USAGE)
  const answer = await bd(tools, 'show', args, '--include-dependents', '--json')
  if (!answer.ok) return message(answer.notFound === true ? `No bead ${args} in this project.` : answer.text)
  const found = asBeads(answer.json)?.[0]
  if (found === undefined) return message(NO_ANSWER)

  const blockers = (found.dependencies ?? []).filter(d => d.dependency_type === 'blocks')
  const children = (found.dependents ?? []).filter(d => d.dependency_type === 'parent-child')
  const head = [
    `${found.id}  ${clip(found.title, 120)}`,
    `status: ${found.status}`,
    `priority: P${found.priority ?? '?'}`,
    `type: ${found.issue_type ?? 'unknown'}`,
    `parent: ${found.parent ?? 'none'}`,
    `labels: ${(found.labels ?? []).join(', ') || 'none'}`,
  ]
  const text = [...head, '', ...describe(found), ...linked('Blocked by', blockers), ...linked('Children', children)]
  return message(finish(text.join('\n')))
}

export const rule: CommandRule = {
  name: 'bead',
  description: 'Show one bead by id (fields, description, blockers, children), read with bd (read-only, not copied)',
  compose,
}
