import { expect, test } from 'claude-code/testing'

import { inMigrationsFolder } from '../hooks/rules/migration'
import { probe } from './probe'

// The files that exist, by path, each with where it really lands.
const EXISTING = {
  '/repo/db/migrations/001_init.sql': '/repo/db/migrations/001_init.sql',
  '/repo/prisma/migrations/20240101_init/migration.sql': '/repo/prisma/migrations/20240101_init/migration.sql',
  '/repo/db/migrate/20240101_create_users.rb': '/repo/db/migrate/20240101_create_users.rb',
  '/repo/alembic/versions/abc_add_email.py': '/repo/alembic/versions/abc_add_email.py',
  '/repo/shop/migrations/0001_initial.py': '/repo/shop/migrations/0001_initial.py',
  '/repo/sql/current/001_init.sql': '/repo/db/migrations/001_init.sql',
  '/repo/src/migrations.ts': '/repo/src/migrations.ts',
  '/repo/cmd/migrate/main.go': '/repo/cmd/migrate/main.go',
  '/repo/docs/migration-guide.md': '/repo/docs/migration-guide.md',
  '/repo/src/app.ts': '/repo/src/app.ts',
}

const CHANGED = [
  '/repo/db/migrations/001_init.sql',
  'db/migrations/001_init.sql',
  '/repo/prisma/migrations/20240101_init/migration.sql',
  '/repo/db/migrate/20240101_create_users.rb',
  '/repo/alembic/versions/abc_add_email.py',
  '/repo/shop/migrations/0001_initial.py',
  '/repo/sql/current/001_init.sql',
]
const PASSED = [
  '/repo/db/migrations/002_add_email.sql',
  'db/migrations/002_add_email.sql',
  '/repo/prisma/migrations/20250101_add/migration.sql',
  '/repo/src/migrations.ts',
  '/repo/cmd/migrate/main.go',
  '/repo/docs/migration-guide.md',
  '/repo/src/app.ts',
]

test('migration-guard: folder table', () => {
  expect(inMigrationsFolder('/repo/db/migrations/001_init.sql')).toBe(true)
  expect(inMigrationsFolder('/repo/db/migrate/1_x.rb')).toBe(true)
  expect(inMigrationsFolder('/repo/db/migration/V1__init.sql')).toBe(true)
  expect(inMigrationsFolder('/repo/alembic/versions/a.py')).toBe(true)
  expect(inMigrationsFolder('C:\\repo\\db\\migrations\\1.sql')).toBe(true)
  expect(inMigrationsFolder('/repo/src/migrations.ts')).toBe(false)
  expect(inMigrationsFolder('/repo/cmd/migrate/main.go')).toBe(false)
  expect(inMigrationsFolder('/repo/api/versions/v1.ts')).toBe(false)
  expect(inMigrationsFolder('/repo/migrations')).toBe(false)
})

test('migration-guard: asks when Write or Edit changes an existing migration', async ($, on) => {
  const guard = probe($, on, { fs: EXISTING })
  for (const file_path of CHANGED) {
    expect({ file_path, answered: await guard.answeredTool({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) }).toEqual({ file_path, answered: true })
    expect({ file_path, answered: await guard.answeredTool({ tool: 'Write', file_path, content: 'x' }) }).toEqual({ file_path, answered: true })
  }
})

test('migration-guard: new migrations and other files pass', async ($, on) => {
  const guard = probe($, on, { fs: EXISTING })
  for (const file_path of PASSED) {
    expect({ file_path, answered: await guard.answeredTool({ tool: 'Write', file_path, content: 'x' }) }).toEqual({ file_path, answered: false })
    expect({ file_path, answered: await guard.answeredTool({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) }).toEqual({ file_path, answered: false })
  }
})

test('migration-guard: reads and shell commands pass', async ($, on) => {
  const guard = probe($, on, { fs: EXISTING })
  expect(await guard.answeredTool({ tool: 'Read', file_path: '/repo/db/migrations/001_init.sql' })).toBe(false)
  expect(await guard.answered('cat db/migrations/001_init.sql')).toBe(false)
})
