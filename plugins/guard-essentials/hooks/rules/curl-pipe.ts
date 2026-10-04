import type { GuardRule } from '../engine'
import { base, blankQuotes, segmentsOf, withoutSudo } from '../shell'
import type { Segment } from '../shell'

// Running code straight off the network leaves nothing to read first. Asks
// when a download feeds a shell or interpreter, by pipe or by substitution.
const DOWNLOADERS = new Set(['curl', 'wget'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish'])
const INTERPRETER = /^(python[\d.]*|node|deno|bun|ruby|perl|php)$/
const FLAG = /^-/

// True when the command reads its program from stdin: no script file, no -c
// or -m. `bash -s` and `python -` name stdin outright.
const readsProgramFromStdin = (argv: readonly string[]): boolean => {
  const [name, ...args] = argv
  if (name === undefined) return false
  const command = base(name)
  const isShell = SHELLS.has(command)
  if (!isShell && !INTERPRETER.test(command)) return false
  if (args.some(arg => arg === '-' || (isShell && /^-[a-z]*s[a-z]*$/.test(arg)))) return true
  if (args.some(arg => /^-[a-z]*[cm][a-z]*$/.test(arg))) return false
  return args.every(arg => FLAG.test(arg))
}

const isDownload = (segment: Segment): boolean => segment.argv[0] !== undefined && DOWNLOADERS.has(base(segment.argv[0]))

const viaPipe = (segments: readonly Segment[]): boolean =>
  segments.some(
    (segment, index) =>
      readsProgramFromStdin(withoutSudo(segment.argv)) &&
      segments.slice(0, index).some(earlier => earlier.pipeline === segment.pipeline && isDownload(earlier)),
  )

// bash <(curl ...), source <(wget ...): quoted text is blanked first.
const SUBSTITUTION = /(?:^|[\s;&|(])(?:\.|source|eval|(?:sudo\s+)?(?:ba|z|da|k)?sh|python[\d.]*|node|ruby|perl)\s+(?:-\S+\s+)*<\(\s*(?:curl|wget)\b/
// sh -c "$(curl ...)", eval "$(curl ...)": the download sits inside quotes.
const COMMAND_SUBSTITUTION = /(?:^|[\s;&|(])(?:eval|(?:ba|z|da|k)?sh\s+-c)\s+["']?\$\(\s*(?:curl|wget)\b/

export const pipesDownloadIntoInterpreter = (command: string): boolean =>
  viaPipe(segmentsOf(command)) || SUBSTITUTION.test(blankQuotes(command)) || COMMAND_SUBSTITUTION.test(command)

export const rule: GuardRule = {
  id: 'curl-pipe-guard',
  decision: 'ask',
  check: e =>
    e.tool === 'Bash' && pipesDownloadIntoInterpreter(e.command)
      ? 'this downloads a script and runs it in one step (curl or wget into a shell or interpreter). Download it to a file and read it first.'
      : undefined,
}
