import type { GuardTools } from './engine'

// `git -C <dir>` runs against another repo. Follow it, as the kit did.
const DASH_C = /git +(?:-[^C]\S* +\S+ +)*-C +(?:"([^"]+)"|'([^']+)'|(\S+))/

export const repoDirFor = (command: string, cwd: string): string => {
  const match = DASH_C.exec(command)
  const dir = match?.[1] ?? match?.[2] ?? match?.[3]
  if (dir === undefined) return cwd
  return dir.startsWith('/') ? dir : `${cwd}/${dir}`
}

export type Repo = { git: (...args: string[]) => Promise<string | undefined> }

// The repo a command works in, or undefined outside a work tree. `git`
// answers stdout, or undefined when git exits non-zero.
export const openRepo = async (command: string, tools: GuardTools): Promise<Repo | undefined> => {
  const cwd = await tools.cwd()
  const dir = repoDirFor(command, cwd)
  const git = async (...args: string[]) => {
    const ran = await tools.run(['git', '-C', dir, ...args], cwd)
    return ran.exitCode === 0 ? ran.stdout : undefined
  }
  return (await git('rev-parse', '--is-inside-work-tree')) === undefined ? undefined : { git }
}

export const lines = (text: string | undefined): string[] =>
  (text ?? '').split('\n').filter(line => line.length > 0)
