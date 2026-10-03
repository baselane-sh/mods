import { expect, test } from 'claude-code/testing'

import { destructiveSqlIn } from '../hooks/rules/prod-db'
import { probe } from './probe'

const TRUNCATE = 'TRUNCATE'
const DELETE = 'DELETE without WHERE'
const UPDATE = 'UPDATE without WHERE'

const HITS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['psql "$DATABASE_URL" -c "TRUNCATE TABLE users"', [TRUNCATE]],
  ['psql -c "truncate users cascade"', [TRUNCATE]],
  ['psql -c "TRUNCATE users, orders;"', [TRUNCATE]],
  ['psql -c "DELETE FROM users"', [DELETE]],
  ['psql -c "delete from users;"', [DELETE]],
  ['mysql -e "DELETE FROM sessions"', [DELETE]],
  ['psql -c "DELETE FROM public.users; SELECT 1"', [DELETE]],
  ['sqlite3 app.db "DELETE FROM logs"', [DELETE]],
  ['psql -c "UPDATE users SET admin = true"', [UPDATE]],
  ['mysql -e "update users set email = \'x\'"', [UPDATE]],
  ['psql -c "DELETE FROM a; UPDATE b SET x = 1;"', [DELETE, UPDATE]],
  ['psql <<SQL\nDELETE FROM users;\nSQL', [DELETE]],
  ['echo "TRUNCATE TABLE users" | psql', [TRUNCATE]],
  ['node -e "db.query(\'DELETE FROM users\')"', [DELETE]],
  ['python manage.py dbshell -c "UPDATE users SET active = false"', [UPDATE]],
]
const MISSES = [
  'psql -c "DELETE FROM users WHERE id = 1"',
  'psql -c "delete from users where created_at < now()"',
  "psql -c \"UPDATE users SET name = 'x' WHERE id = 1\"",
  'psql -c "UPDATE users SET a = 1, b = 2 WHERE id IN (1, 2)"',
  'psql -c "SELECT * FROM users"',
  'psql -c "INSERT INTO users (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET name = excluded.name"',
  'truncate -s 0 app.log',
  'truncate -s 100M big.img',
  'echo "DELETE FROM users"',
  'grep -rn "DELETE FROM" src',
  'git commit -m "TRUNCATE TABLE users is gone"',
  'git commit -m "feat: delete from cache on logout"',
  'cat README.md',
  'npm test',
]

// DROP is infra-guard's: it asks, and prod-db-guard stays silent.
const DROP = 'psql -c "DROP TABLE users"'

test('prod-db-guard: DROP is left to infra-guard', () => {
  expect(destructiveSqlIn(DROP)).toEqual([])
})

test('prod-db-guard: command table', () => {
  for (const [command, found] of HITS) expect({ command, found: destructiveSqlIn(command) }).toEqual({ command, found })
  for (const command of MISSES) expect({ command, found: destructiveSqlIn(command) }).toEqual({ command, found: [] })
})

test('prod-db-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
