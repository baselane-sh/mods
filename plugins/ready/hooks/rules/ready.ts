import { asBeads, bd, byPriorityThenAge, NO_ANSWER, row } from '../beads'
import type { CommandRule, CommandTools, Composed } from '../engine'
import { finish, message } from '../helpers'

const SHOWN = 20

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  // -n 0: bd stops at 100 by default, and the count line must be the real one.
  const answer = await bd(tools, 'ready', '--json', '-n', '0')
  if (!answer.ok) return message(answer.text)
  const beads = asBeads(answer.json)
  if (beads === undefined) return message(NO_ANSWER)
  const top = [...beads].sort(byPriorityThenAge).slice(0, SHOWN)
  const total = beads.length > SHOWN ? `${SHOWN} of ${beads.length} ready` : `${beads.length} ready`
  return message(finish([...top.map(row), total].join('\n')))
}

export const rule: CommandRule = {
  name: 'ready',
  description: 'List the 20 top ready beads, read with bd (read-only, not copied)',
  compose,
}
