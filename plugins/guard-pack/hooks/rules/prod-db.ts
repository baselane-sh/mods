import type { GuardRule } from '../engine'
import { base, segmentsOf } from '../shell'

// Destructive SQL typed into a command. DROP is infra-guard's. The check
// reads the command text (and a heredoc body); a `psql -f file.sql` is not
// opened.
const SQL_CLIENTS = new Set([
  'psql', 'pgcli', 'mysql', 'mycli', 'mariadb', 'sqlite3', 'litecli', 'sqlcmd', 'sqlplus',
  'clickhouse-client', 'duckdb', 'usql', 'cockroach', 'snowsql', 'dolt', 'turso',
])
// Commands that print or search text and never run it as SQL.
const TEXT_ONLY = new Set(['git', 'gh', 'echo', 'printf', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'cat', 'head', 'tail', 'less', 'man', 'which'])

// A table name, possibly schema-qualified or wrapped in escaped quotes.
const TABLE = '[\\\\"\'`]*[\\w.]+[\\\\"\'`]*'
// A statement runs to the next `;` or `&&`; any WHERE inside it counts.
const REST = '((?:(?!&&)[^;])*)'

type Check = { name: string; source: string; needsWhere: boolean }

const CHECKS: readonly Check[] = [
  { name: 'TRUNCATE', source: `\\bTRUNCATE\\s+(?:TABLE\\s+)?(?:ONLY\\s+)?${TABLE}`, needsWhere: false },
  { name: 'DELETE without WHERE', source: `\\bDELETE\\s+FROM\\s+(?:ONLY\\s+)?${TABLE}${REST}`, needsWhere: true },
  { name: 'UPDATE without WHERE', source: `\\bUPDATE\\s+(?:ONLY\\s+)?${TABLE}\\s+SET\\b${REST}`, needsWhere: true },
]

const hasWhere = (rest: string): boolean => /\bwhere\b/i.test(rest)

// Keywords are written in capitals; `ignoreCase` also accepts `delete from`.
const matches = (check: Check, text: string, ignoreCase: boolean): boolean =>
  [...text.matchAll(new RegExp(check.source, ignoreCase ? 'gi' : 'g'))].some(match => !check.needsWhere || !hasWhere(match[1] ?? ''))

export const destructiveSqlIn = (command: string): readonly string[] => {
  const segments = segmentsOf(command)
  const hasClient = segments.some(({ argv }) => argv.some(word => SQL_CLIENTS.has(base(word))))
  const isTextOnly = segments.every(({ argv }) => argv[0] === undefined || TEXT_ONLY.has(base(argv[0])))
  // Without a SQL client only the capitalised spelling counts, which keeps
  // `truncate -s 0 log` and prose like "delete from cache" quiet.
  if (!hasClient && isTextOnly) return []
  return CHECKS.filter(check => matches(check, command, hasClient)).map(check => check.name)
}

export const rule: GuardRule = {
  id: 'prod-db-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = destructiveSqlIn(e.command)
    return found.length === 0 ? undefined : `this runs destructive SQL (${found.join(', ')}). Check the target database is not production and the statement has the WHERE you mean.`
  },
}
