import type { GuardRule } from '../engine'
import { SECRET_VAR_NAMES } from '../patterns'

// Asks before a command prints the process environment, echoes a
// secret-named variable, or sends local data to a remote host. Wrappers
// (`env FOO=bar cmd`, `env -i`), `set`, `echo $HOME`, downloads, auth headers
// and anything aimed at localhost stay silent.
const START = '(^|[;&|(]\\s*)'
const TAIL = '\\s*($|[|;&>)])'
const VARNAME = '[A-Za-z_][A-Za-z0-9_]*'
const DUMP = new RegExp(`${START}(env|printenv)(${TAIL}|\\s+${VARNAME}${TAIL})`, 'm')
const PROC_ENVIRON = /\/proc\/[^/\s]+\/environ/

const SECRET_VAR = `\\$\\{?[A-Za-z0-9_]*${SECRET_VAR_NAMES}[A-Za-z0-9_]*\\}?`
const ECHO_SEGMENT = `(echo|printf)[^|;&>)]*${SECRET_VAR}`
const ECHO = new RegExp(ECHO_SEGMENT)
// Followed by a pipe, redirect or closing paren: the value goes to another
// process or a file, not to the transcript.
const ECHO_CAPTURED = new RegExp(`${ECHO_SEGMENT}[^|;&>)]*[|>)]`)

const SENDER = /(^|[\s|;&(])(curl|wget|nc|ncat)\s/m
const LOCAL_URL = /https?:\/\/(localhost|127\.[0-9.]+|0\.0\.0\.0|\[::1\])[^\s"']*/g
const REMOTE_URL = /https?:\/\/[^/\s"']+/
const NC_REMOTE = /(^|[|;&]\s*)(nc|ncat)\s+[^\s-]\S*\s+[0-9]+/m
const NC_LOCAL = /(nc|ncat)\s+(localhost|127\.[0-9.]+)/
const PAYLOAD =
  /(-d|--data(-binary|-raw|-urlencode|-ascii)?|-F|--form(-string)?|--post-data|--body-data)[= ]+["']?[^\s"']*(\$|@)/
const UPLOAD = /(-T|--upload-file|--post-file|--body-file)[= ]/
const PIPED = /\|\s*(curl|wget|nc|ncat)\s/

const sendsToRemote = (command: string): boolean => {
  if (!SENDER.test(command)) return false
  const stripped = command.replace(LOCAL_URL, '')
  const isRemote = REMOTE_URL.test(stripped) || (NC_REMOTE.test(stripped) && !NC_LOCAL.test(stripped))
  return isRemote && (PAYLOAD.test(stripped) || UPLOAD.test(stripped) || PIPED.test(stripped))
}

export const exfilReason = (command: string): string | undefined => {
  if (DUMP.test(command)) {
    return 'this command prints the process environment (env, printenv), which puts every secret in it into the transcript.'
  }
  if (PROC_ENVIRON.test(command)) {
    return "this command reads /proc/*/environ, which exposes another process's secrets."
  }
  if (ECHO.test(command) && !ECHO_CAPTURED.test(command)) {
    return 'this command echoes a secret-named variable, which prints its value into the transcript.'
  }
  if (sendsToRemote(command)) {
    return 'this command sends local data (a variable, a file or piped content) to a remote host.'
  }
  return undefined
}

export const rule: GuardRule = {
  id: 'env-exfil-guard',
  decision: 'ask',
  check: e => (e.tool === 'Bash' ? exfilReason(e.command) : undefined),
}
