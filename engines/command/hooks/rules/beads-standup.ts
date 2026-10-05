import { asBeads, bd, byPriorityThenAge, NO_ANSWER, row, yesterdayStart } from '../beads'
import type { Bead } from '../beads'
import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, message } from '../helpers'

const NEXT = 5
const LIST_CAP = 15

const section = (title: string, beads: readonly Bead[], limit = LIST_CAP): string[] => [
  `${title} (${beads.length})`,
  ...(beads.length === 0 ? ['  none'] : beads.slice(0, limit).map(b => `  ${row(b)}`)),
  ...(beads.length > limit ? [`  +${beads.length - limit} more`] : []),
]

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  const closed = await bd(tools, 'list', '--status', 'closed', '--closed-after', yesterdayStart(new Date()), '--json', '-n', '0')
  if (!closed.ok) return message(closed.text)
  const doing = await bd(tools, 'list', '--status', 'in_progress', '--json', '-n', '0')
  if (!doing.ok) return message(doing.text)
  const ready = await bd(tools, 'ready', '--json', '-n', '0')
  if (!ready.ok) return message(ready.text)

  const lists = [asBeads(closed.json), asBeads(doing.json), asBeads(ready.json)]
  const [done, active, next] = lists
  if (done === undefined || active === undefined || next === undefined) return message(NO_ANSWER)

  const soonest = [...next].sort(byPriorityThenAge)
  return message(
    finish(
      [
        ...section('Closed since yesterday', done),
        '',
        ...section('In progress', active),
        '',
        ...section('Next 5 ready', soonest.slice(0, NEXT)),
      ].join('\n'),
    ),
  )
}

export const rule: CommandRule = {
  name: 'beads-standup',
  description: 'List beads closed since yesterday, in progress, and the next 5 ready, read with bd (read-only, not copied)',
  compose,
}
