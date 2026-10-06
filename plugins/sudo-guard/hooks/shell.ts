// A small shell reader for the rules that must tell a command from text that
// only mentions it (`grep sudo README.md`, `echo "no-verify"`). It splits a
// command line into simple commands, honours quotes and escapes, skips
// heredoc bodies and follows `sh -c '...'`, `eval ...` and command
// substitution (`$(...)` and backticks) inside double quotes. It is not a full
// parser: single-quoted text is never entered, and aliases are not tracked.

export type Segment = {
  // Commands joined by `|` share a pipeline id.
  pipeline: string
  // NAME=value words in front of the command.
  env: readonly string[]
  // The command and its arguments, with env, command, exec, nohup, time and
  // builtin removed from the front.
  argv: readonly string[]
}

type Raw = { pipeline: string; words: string[] }

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const WRAPPERS = new Set(['command', 'exec', 'nohup', 'time', 'builtin', 'env'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh'])
const DASH_C = /^-[a-z]*c[a-z]*$/
const MAX_DEPTH = 3

export const base = (word: string): string => word.slice(word.lastIndexOf('/') + 1)

// sudo and doas options whose value is the next word. `-h` stays out: alone
// it means help.
const SUDO_VALUE_FLAGS = new Set(['-u', '-g', '-C', '-D', '-p', '-r', '-t', '-T', '-U', '--user', '--group', '--close-from', '--chdir', '--prompt', '--role', '--type', '--command-timeout', '--other-user'])

// `sudo -E npm i x` and `sudo -u deploy npm i x` read as `npm i x` for a rule
// about the command that runs.
export const withoutSudo = (argv: readonly string[]): readonly string[] => {
  if (argv[0] === undefined || !['sudo', 'doas'].includes(base(argv[0]))) return argv
  const { sub, args } = subcommandOf(argv, SUDO_VALUE_FLAGS)
  return sub === undefined ? [] : [sub, ...args]
}

// The index after a `"..."` span that starts at `open`. A `$(...)` inside it
// is skipped whole, so its quotes and parens do not end the span early.
const skipDoubleQuoted = (text: string, open: number): number => {
  let j = open + 1
  while (j < text.length && text[j] !== '"') {
    if (text[j] === '\\') j += 2
    else if (text[j] === '$' && text[j + 1] === '(') j = readParenSub(text, j).end
    else if (text[j] === '`') j = readBacktickSub(text, j).end
    else j += 1
  }
  return j + 1
}

// The index after a heredoc whose `<<` is at `open`: the rest of that line and
// the body up to the line that is exactly the delimiter. A body is text, so
// its quotes and parens never count.
const skipHeredoc = (text: string, open: number): number => {
  let j = open + 2
  const strip = text[j] === '-'
  if (strip) j += 1
  while (text[j] === ' ' || text[j] === '\t') j += 1
  let delimiter = ''
  while (j < text.length && !/[\s;&|<>()]/.test(text[j]!)) {
    if (text[j] !== "'" && text[j] !== '"' && text[j] !== '\\') delimiter += text[j]
    j += 1
  }
  const eol = text.indexOf('\n', j)
  if (eol < 0) return open + 2
  j = eol + 1
  while (j < text.length) {
    const end = text.indexOf('\n', j)
    const line = text.slice(j, end < 0 ? text.length : end)
    j = end < 0 ? text.length : end + 1
    if ((strip ? line.replace(/^\t+/, '') : line) === delimiter) break
  }
  return j
}

// The text of a `$(...)` that starts at `open` (the index of `$`), and the
// index after its `)`. Nested parens, quotes and heredoc bodies are skipped.
// A heredoc start is taken as a heredoc only when it is followed by a word.
function readParenSub(text: string, open: number): { inner: string; end: number } {
  let depth = 1
  let j = open + 2
  while (j < text.length && depth > 0) {
    const c = text[j]!
    if (c === "'") {
      const close = text.indexOf("'", j + 1)
      j = close < 0 ? text.length : close + 1
    } else if (c === '"') {
      j = skipDoubleQuoted(text, j)
    } else if (c === '`') {
      j = readBacktickSub(text, j).end
    } else if (c === '<' && text[j + 1] === '<' && text[j + 2] !== '<' && text[j + 2] !== '(') {
      j = skipHeredoc(text, j)
    } else {
      if (c === '\\') j += 1
      else if (c === '(') depth += 1
      else if (c === ')') depth -= 1
      j += 1
    }
  }
  return { inner: text.slice(open + 2, depth === 0 ? j - 1 : j), end: j }
}

// The text of a backtick span that starts at `open`, and the index after it.
function readBacktickSub(text: string, open: number): { inner: string; end: number } {
  let j = open + 1
  while (j < text.length && text[j] !== '`') j += text[j] === '\\' ? 2 : 1
  return { inner: text.slice(open + 1, j).replace(/\\([`$\\])/g, '$1'), end: j + 1 }
}

// Raw simple commands, plus the text of every command substitution found
// inside double quotes (the shell runs those).
const tokenize = (text: string, prefix: string): { raws: Raw[]; subs: string[] } => {
  const out: Raw[] = []
  const subs: string[] = []
  const heredocs: Array<{ delimiter: string; strip: boolean }> = []
  let words: string[] = []
  let cur = ''
  let inWord = false
  let pipe = 0
  let i = 0

  const endWord = () => {
    if (inWord) words.push(cur)
    cur = ''
    inWord = false
  }
  const endSegment = (startsPipeline: boolean) => {
    endWord()
    if (words.length > 0) out.push({ pipeline: `${prefix}${pipe}`, words })
    words = []
    if (startsPipeline) pipe += 1
  }
  const skipHeredocBodies = () => {
    for (const { delimiter, strip } of heredocs) {
      while (i < text.length) {
        const eol = text.indexOf('\n', i)
        const line = text.slice(i, eol < 0 ? text.length : eol)
        i = eol < 0 ? text.length : eol + 1
        if ((strip ? line.replace(/^\t+/, '') : line) === delimiter) break
      }
    }
    heredocs.length = 0
  }
  const readHeredocStart = () => {
    i += 2
    const strip = text[i] === '-'
    if (strip) i += 1
    while (text[i] === ' ' || text[i] === '\t') i += 1
    let delimiter = ''
    while (i < text.length && !/[\s;&|<>()]/.test(text[i]!)) {
      if (text[i] !== "'" && text[i] !== '"' && text[i] !== '\\') delimiter += text[i]
      i += 1
    }
    heredocs.push({ delimiter, strip })
  }

  while (i < text.length) {
    const c = text[i]!
    const next = text[i + 1]
    if (c === '\\') {
      if (next !== '\n' && next !== undefined) {
        cur += next
        inWord = true
      }
      i += 2
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1)
      const stop = end < 0 ? text.length : end
      cur += text.slice(i + 1, stop)
      inWord = true
      i = stop + 1
    } else if (c === '"') {
      inWord = true
      i += 1
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length && '"\\$`'.includes(text[i + 1]!)) {
          cur += text[i + 1]
          i += 2
        } else if ((text[i] === '$' && text[i + 1] === '(') || text[i] === '`') {
          const sub = text[i] === '`' ? readBacktickSub(text, i) : readParenSub(text, i)
          subs.push(sub.inner)
          cur += text.slice(i, sub.end)
          i = sub.end
        } else {
          cur += text[i]
          i += 1
        }
      }
      i += 1
    } else if (c === ' ' || c === '\t') {
      endWord()
      i += 1
    } else if (c === '\n') {
      endSegment(true)
      i += 1
      skipHeredocBodies()
    } else if (c === '#' && !inWord) {
      while (i < text.length && text[i] !== '\n') i += 1
    } else if (c === ';' || c === '(' || c === ')' || c === '`') {
      endSegment(true)
      i += 1
    } else if (c === '&') {
      if (next === '&') {
        endSegment(true)
        i += 2
      } else if (next === '>' || cur.endsWith('>') || cur.endsWith('<')) {
        cur += c // 2>&1, &>file
        inWord = true
        i += 1
      } else {
        endSegment(true)
        i += 1
      }
    } else if (c === '|') {
      const isOr = next === '|'
      endSegment(isOr)
      i += isOr || next === '&' ? 2 : 1
    } else if (c === '<' && next === '<' && text[i + 2] !== '<') {
      readHeredocStart()
    } else if ((c === '>' || c === '<') && inWord && !/^(\d*|&)[<>]*$/.test(cur)) {
      // `key.pub>>file` is the word `key.pub` and the redirect `>>file`;
      // `2>&1` and `&>file` stay one word.
      endWord()
      cur = c
      inWord = true
      i += 1
    } else {
      cur += c
      inWord = true
      i += 1
    }
  }
  endSegment(false)
  return { raws: out, subs }
}

const unwrap = (words: readonly string[]): { env: string[]; argv: string[] } => {
  const env: string[] = []
  let rest = [...words]
  while (rest[0] !== undefined) {
    const word = rest[0]
    if (ASSIGNMENT.test(word)) {
      env.push(word)
      rest = rest.slice(1)
    } else if (WRAPPERS.has(base(word))) {
      const isEnv = base(word) === 'env'
      rest = rest.slice(1)
      while (isEnv && rest[0]?.startsWith('-')) rest = rest.slice(1)
    } else {
      break
    }
  }
  return { env, argv: rest }
}

const segmentsAt = (command: string, prefix: string, depth: number): Segment[] => {
  const { raws, subs } = tokenize(command, prefix)
  const inSubs = depth < MAX_DEPTH ? subs.flatMap((sub, index) => segmentsAt(sub, `${prefix}s${index}.`, depth + 1)) : []
  return [...segmentsFrom(raws, prefix, depth), ...inSubs]
}

const segmentsFrom = (raws: readonly Raw[], prefix: string, depth: number): Segment[] =>
  raws.flatMap((raw, index) => {
    const { env, argv } = unwrap(raw.words)
    const own: Segment = { pipeline: raw.pipeline, env, argv }
    const flag = argv.findIndex(word => DASH_C.test(word))
    const script = argv[flag + 1]
    const isShellC = argv[0] !== undefined && SHELLS.has(base(argv[0])) && flag > 0 && script !== undefined
    if (isShellC && depth < MAX_DEPTH) return [own, ...segmentsAt(script, `${prefix}${index}.`, depth + 1)]
    // `eval a b` runs the words joined by spaces as a command line.
    const isEval = argv[0] === 'eval' && argv.length > 1
    return isEval && depth < MAX_DEPTH ? [own, ...segmentsAt(argv.slice(1).join(' '), `${prefix}${index}.`, depth + 1)] : [own]
  })

export const segmentsOf = (command: string): readonly Segment[] => segmentsAt(command, '', 0)

// The command with every quoted span blanked, for patterns that must not
// match text inside quotes.
export const blankQuotes = (command: string): string =>
  command.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, span => `${span[0]}${'_'.repeat(span.length - 2)}${span[0]}`)

// A CLI call split at its subcommand: the global options in front, the
// subcommand and the words after it. `valueFlags` names the options whose
// value is the next word (`-C dir`); `--opt=value` is one word already.
export type Subcommand = { globals: readonly string[]; sub: string | undefined; args: readonly string[] }

export const subcommandOf = (argv: readonly string[], valueFlags: ReadonlySet<string>): Subcommand => {
  let i = 1
  while (i < argv.length && argv[i]!.startsWith('-')) i += valueFlags.has(argv[i]!) ? 2 : 1
  return { globals: argv.slice(1, i), sub: argv[i], args: argv.slice(i + 1) }
}

const XARGS_VALUE_FLAGS = new Set(['-I', '-J', '-L', '-n', '-P', '-s', '-d', '-E', '-R', '-S', '-a', '--max-args', '--max-procs', '--max-lines', '--delimiter', '--arg-file', '--eof'])

// `ls | xargs chmod 777` reads as `chmod 777` for a rule about the command
// that runs.
export const withoutXargs = (argv: readonly string[]): readonly string[] => {
  if (argv[0] === undefined || base(argv[0]) !== 'xargs') return argv
  const { sub, args } = subcommandOf(argv, XARGS_VALUE_FLAGS)
  return sub === undefined ? [] : [sub, ...args]
}

// Every simple command in a command line as the argv that really runs, past
// sudo and xargs.
export const commandsOf = (command: string): ReadonlyArray<readonly string[]> =>
  segmentsOf(command).map(({ argv }) => withoutSudo(withoutXargs(withoutSudo(argv))))

// True when a short option cluster (`-fdx`) holds the letter.
export const hasShortFlag = (word: string, letter: string): boolean => /^-[a-zA-Z]+$/.test(word) && word.includes(letter)
