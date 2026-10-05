// Says whether a Bash command line closes a bead: some command in it is
// `bd close` or `bd done` (the alias), run for real. It only reads the text;
// it never runs anything. The sound and stats engines each keep their own
// copy of this file (a mod may import only its own files), and a test in each
// holds the same table.
//
// Quoted text is one word, so `echo "bd close x"` is an echo. A command that
// is written inside a string for another shell (`bash -c "bd close x"`) is
// not seen. The caller checks the exit code: a line that ends with exit 0
// but hid a failed close (`bd close x || true`) still counts, a limit of
// reading only the text.

// bd's global flags that take a value as the next word (`--flag=value` is one word).
const VALUE_FLAGS = new Set(['-C', '--directory', '--actor', '--db', '--dolt-auto-commit'])
// Words that may stand before a command and leave it the same command.
const PREFIXES = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', 'time', 'command', 'exec', 'nohup', 'sudo', 'env'])
const CLOSERS = new Set(['close', 'done'])
const HEREDOC = /<<-?\s*(['"]?)([A-Za-z_][\w-]*)\1/g

const withoutHeredocs = (command: string): string => {
  const lines = command.split('\n')
  const kept: string[] = []
  let ends: string | undefined
  for (const line of lines) {
    if (ends !== undefined) {
      if (line.trim() === ends) ends = undefined
      continue
    }
    kept.push(line)
    const match = [...line.matchAll(HEREDOC)].at(-1)
    if (match !== undefined) ends = match[2]
  }
  return kept.join('\n')
}

// The commands of a line as lists of words. Quotes group a word and are
// dropped; `;`, `&`, `|`, a newline and a parenthesis or brace end a command.
const commandsOf = (line: string): string[][] => {
  const commands: string[][] = []
  let words: string[] = []
  let word = ''
  let inWord = false
  let quote: '"' | "'" | undefined
  const endWord = () => {
    if (inWord) words = [...words, word]
    word = ''
    inWord = false
  }
  const endCommand = () => {
    endWord()
    if (words.length > 0) commands.push(words)
    words = []
  }
  for (let i = 0; i < line.length; i += 1) {
    const ch = line.charAt(i)
    if (quote !== undefined) {
      if (ch === quote) quote = undefined
      else if (ch === '\\' && quote === '"' && i + 1 < line.length) word += line.charAt(++i)
      else word += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      inWord = true
    } else if (ch === '\\' && i + 1 < line.length) {
      word += line.charAt(++i)
      inWord = true
    } else if (ch === ' ' || ch === '\t') endWord()
    else if (';&|\n(){}`'.includes(ch)) endCommand()
    else {
      word += ch
      inWord = true
    }
  }
  endCommand()
  return commands
}

const isBd = (word: string): boolean => word === 'bd' || word.endsWith('/bd')

const closes = (words: readonly string[]): boolean => {
  let i = 0
  // Leading words that do not change the command: keywords, wrappers, NAME=value.
  while (i < words.length && (PREFIXES.has(words[i] ?? '') || /^[A-Za-z_]\w*=/.test(words[i] ?? ''))) i += 1
  if (!isBd(words[i] ?? '')) return false
  i += 1
  while (i < words.length && (words[i] ?? '').startsWith('-')) {
    i += VALUE_FLAGS.has(words[i] ?? '') ? 2 : 1
  }
  if (!CLOSERS.has(words[i] ?? '')) return false
  // Help and a read-only run change nothing.
  return !words.some(word => word === '-h' || word === '--help' || word === '--readonly')
}

export const closesBead = (command: string): boolean => commandsOf(withoutHeredocs(command)).some(closes)
