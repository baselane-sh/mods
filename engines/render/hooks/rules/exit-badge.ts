import { beside } from '../badge'
import type { RenderRule } from '../engine'
import { exitCodeOf } from '../output'

export const create = (): RenderRule => ({
  id: 'exit-badge',
  toolRow: {
    tools: ['Bash'],
    draw: ({ e, row, elements }) => {
      // Only a failed call stores its exit code; an abort draws Interrupted.
      if (!e.props.isErrored || e.props.isInterrupted) return undefined
      const code = exitCodeOf(e.props.output)
      if (code === undefined || code === 0) return undefined
      return beside(elements, row, 'exit-badge', `exit ${code}`, { color: 'red' })
    },
  },
})
