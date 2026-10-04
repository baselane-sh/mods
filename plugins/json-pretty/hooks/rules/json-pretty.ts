import type { RenderRule } from '../engine'
import { isRecord, prettyJson } from '../output'

export const create = (): RenderRule => ({
  id: 'json-pretty',
  toolResult: {
    tools: ['Bash'],
    // The props are the drawing's copy: the stored result, and what the
    // model read, stay as they were.
    rewrite: props => {
      const { output, isErrored } = props
      if (isErrored || !isRecord(output) || typeof output.stdout !== 'string') return undefined
      const pretty = prettyJson(output.stdout)
      return pretty === undefined ? undefined : { ...props, output: { ...output, stdout: pretty } }
    },
  },
})
