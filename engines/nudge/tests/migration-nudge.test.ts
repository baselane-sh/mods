import { expect, test } from 'claude-code/testing'

import { probe, FAIL_WORD } from './probe'

const NUDGE = (names: string) => `migration-nudge: schema changed (${names}) and no migration file was created this session. Add a migration.`

for (const path of ['prisma/schema.prisma', 'app/models.py', 'db/schema/users.sql', 'src/db/schema.ts', 'drizzle/schema/posts.ts']) {
  test(`migration-nudge: ${path} gives one toast naming it`, async ($, on) => {
    const session = probe($, on)
    await session.edit(path)
    expect(await session.stop()).toEqual([NUDGE(path)])
  })
}

test('migration-nudge: other files stay quiet', async ($, on) => {
  const session = probe($, on)
  await session.edit('src/models.ts')
  await session.edit('queries/users.sql')
  await session.edit('src/schema.ts')
  await session.edit('README.md')
  expect(await session.stop()).toEqual([])
})

for (const migration of ['prisma/migrations/20260101_init/migration.sql', 'alembic/versions/0002_add.py', 'drizzle/0001_add.sql', 'db/migrate/20260101_add.rb', 'supabase/migrations/1_add.sql']) {
  test(`migration-nudge: new file ${migration} written after the schema edit silences it`, async ($, on) => {
    const session = probe($, on)
    await session.edit('prisma/schema.prisma')
    await session.write(migration)
    expect(await session.stop()).toEqual([])
  })

  test(`migration-nudge: new file ${migration} written before the schema edit silences it`, async ($, on) => {
    const session = probe($, on)
    await session.write(migration)
    await session.edit('prisma/schema.prisma')
    expect(await session.stop()).toEqual([])
  })
}

test('migration-nudge: editing an existing migration is not a new one', async ($, on) => {
  const session = probe($, on)
  await session.edit('prisma/schema.prisma')
  await session.edit('prisma/migrations/1_init/migration.sql')
  expect(await session.stop()).toEqual([NUDGE('prisma/schema.prisma')])
})

for (const command of ['npx prisma migrate dev --name add_users', 'npx drizzle-kit generate', 'alembic revision --autogenerate -m x', 'python manage.py makemigrations', 'supabase migration new add_users']) {
  test(`migration-nudge: ${command} silences it`, async ($, on) => {
    const session = probe($, on)
    await session.edit('prisma/schema.prisma')
    await session.bash(command)
    expect(await session.stop()).toEqual([])
  })
}

test('migration-nudge: a failed or unrelated command does not', async ($, on) => {
  const session = probe($, on)
  await session.edit('prisma/schema.prisma')
  await session.bash(`prisma migrate dev ${FAIL_WORD}`)
  await session.bash('echo alembic revision')
  await session.bash('prisma generate')
  expect(await session.stop()).toEqual([NUDGE('prisma/schema.prisma')])
})

test('migration-nudge: one toast per batch, several schema files named together', async ($, on) => {
  const session = probe($, on)
  await session.edit('prisma/schema.prisma')
  await session.edit('app/models.py')
  await session.edit('app/models.py')
  expect(await session.stop()).toEqual([NUDGE('prisma/schema.prisma, app/models.py')])
  expect(await session.stop()).toEqual([])
})
