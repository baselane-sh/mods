import type { ProcessRunResult, ToolCallResult } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

export const CWD = '/repo'

// Answers for `git -C /repo <args>`, keyed by the args joined with spaces.
// A key that is absent makes git exit 1. Leave out `rev-parse
// --is-inside-work-tree` to stand for a directory outside any repo.
export type GitAnswers = Readonly<Record<string, string>>

// `truncated` names git answers that come back cut at the host's cap. `fs`
// maps each path that exists to where it really lands (a symbolic link maps
// to its target); any other path is missing and `fs.stat` rejects for it.
export type ProbeOptions = {
  git?: GitAnswers
  truncated?: readonly string[]
  output?: string
  fs?: Readonly<Record<string, string>>
}

type ToolArgs = Parameters<Engine['tool']['call']>[0]

export type Probe = {
  answered: (command: string) => Promise<boolean>
  answeredTool: (args: ToolArgs) => Promise<boolean>
  run: (command: string) => Promise<ToolCallResult>
}

const processResult = (stdout: string | undefined, isStdoutTruncated: boolean): ProcessRunResult => ({
  exitCode: stdout === undefined ? 1 : 0,
  stdout: stdout ?? '',
  stderr: '',
  isStdoutTruncated,
  isStderrTruncated: false,
})

// Stands in for the engine beneath the guards. When a guard answers a call
// (ask or deny), the engine's own PreToolUse hooks beneath it are not
// reached; when every guard passes, they are.
export const probe = ($: Engine, on: OnFn, options: ProbeOptions = {}): Probe => {
  let reached = 0
  const prefix = `git -C ${CWD} `
  const output = options.output ?? ''

  on('session.cwd', () => ({ value: CWD }))
  on('process.run', (_$, e) => {
    const command = e.argv.join(' ')
    const key = command.startsWith(prefix) ? command.slice(prefix.length) : command
    return { value: processResult(options.git?.[key], options.truncated?.includes(key) ?? false) }
  })
  on('fs.stat', (_$, e) => {
    const realPath = options.fs?.[e.path]
    if (realPath === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false, realPath } }
  })
  on('classic.PreToolUse', ($, e, next) => {
    reached += 1
    return next(e)
  })
  on('tool.call', () => ({ result: { stdout: output, stderr: '', interrupted: false }, text: output }))

  const run = (command: string) => $.tool.call({ tool: 'Bash', command })

  const answeredTool = async (args: ToolArgs) => {
    const before = reached
    await $.tool.call(args)
    return reached === before
  }

  return {
    run,
    answeredTool,
    answered: command => answeredTool({ tool: 'Bash', command }),
  }
}
