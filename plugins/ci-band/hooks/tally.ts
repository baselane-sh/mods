import type { Tally } from '../types'

// An MCP tool is `mcp__server__tool`: the band names it by `tool`.
export const shortTool = (tool: string): string => tool.split('__').filter(part => part !== '').pop() ?? tool

export const addCall = (current: Tally, tool: string, isFailure: boolean): Tally => {
  const name = shortTool(tool)
  return {
    calls: { ...current.calls, [name]: (current.calls[name] ?? 0) + 1 },
    failures: current.failures + (isFailure ? 1 : 0),
    ...(isFailure ? { lastFailed: name } : current.lastFailed === undefined ? {} : { lastFailed: current.lastFailed }),
  }
}
