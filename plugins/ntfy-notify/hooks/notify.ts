import type { RunTools } from './engine'
import { projectName } from './ntfy'

// Shared by the local notification rules. There is no platform API for
// plugins, so `uname -s` tells macOS apart. On Windows `uname` and `which`
// are missing and the run rejects: that reads as "not macOS, not installed".
export const TITLE = 'Claude Code'

export const needsInputText = (cwd: string): string => `Needs your input (${projectName(cwd)})`

export const isMac = async (tools: RunTools): Promise<boolean> => {
  try {
    const answer = await tools.run(['uname', '-s'])
    return answer.exitCode === 0 && answer.stdout.trim() === 'Darwin'
  } catch {
    return false
  }
}

export const hasProgram = async (tools: RunTools, name: string): Promise<boolean> => {
  try {
    const answer = await tools.run(['which', name])
    return answer.exitCode === 0 && answer.stdout.trim() !== ''
  } catch {
    return false
  }
}

// Runs a program and throws on a non-zero exit, so the engine logs it.
export const mustRun = async (tools: RunTools, argv: readonly string[]): Promise<void> => {
  const answer = await tools.run(argv)
  if (answer.exitCode !== 0) throw new Error(`${argv[0]} exited ${answer.exitCode}`)
}
