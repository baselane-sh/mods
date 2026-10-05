import { expect, test } from 'claude-code/testing'

import { dbResetsIn } from '../hooks/rules/db-reset'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['prisma migrate reset', 'prisma migrate reset'],
  ['npx prisma migrate reset --force', 'prisma migrate reset'],
  ['pnpm prisma migrate reset', 'prisma migrate reset'],
  ['pnpm exec prisma migrate reset', 'prisma migrate reset'],
  ['yarn prisma migrate reset', 'prisma migrate reset'],
  ['bunx prisma db push --force-reset', 'prisma db push --force-reset'],
  ['rails db:drop', 'rails db:drop'],
  ['bin/rails db:reset', 'rails db:reset'],
  ['bundle exec rails db:drop:all', 'rails db:drop:all'],
  ['RAILS_ENV=production rails db:migrate:reset', 'rails db:migrate:reset'],
  ['rake db:drop', 'rake db:drop'],
  ['bundle exec rake db:reset', 'rake db:reset'],
  ['alembic downgrade base', 'alembic downgrade'],
  ['uv run alembic downgrade -1', 'alembic downgrade'],
  ['python manage.py flush --no-input', 'django flush'],
  ['python3 manage.py flush', 'django flush'],
  ['django-admin flush', 'django flush'],
  ['python -m django flush', 'django flush'],
  ['supabase db reset', 'supabase db reset'],
  ['supabase db reset --linked', 'supabase db reset'],
  ['npx knex migrate:rollback --all', 'knex migrate:rollback --all'],
  ['knex migrate:rollback --all --env production', 'knex migrate:rollback --all'],
]
const MISSES = [
  'prisma migrate dev',
  'npx prisma migrate deploy',
  'prisma db push',
  'prisma generate',
  'rails db:migrate',
  'rails db:seed',
  'rails db:create',
  'rake db:migrate',
  'alembic upgrade head',
  'alembic downgrade base --sql',
  'alembic history',
  'python manage.py migrate',
  'python manage.py flushcache',
  'supabase db push',
  'supabase start',
  'knex migrate:rollback',
  'knex migrate:latest',
  'echo "rails db:drop"',
  'grep "prisma migrate reset" docs/setup.md',
  'git commit -m "supabase db reset notes"',
]

test('db-reset-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: dbResetsIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: dbResetsIn(command) }).toEqual({ command, found: [] })
})

test('db-reset-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
