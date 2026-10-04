import type { Nudge } from '../engine'
import { fileEdit, inCommand, ranOk } from '../edits'

const MIGRATION_FILE = [
  /(^|\/)migrations?\//, /(^|\/)alembic\/versions\//, /(^|\/)db\/migrate\//, /(^|\/)drizzle\/[^/]+\.sql$/,
]

// Schema files: Prisma, Django models, SQL under a schema/ folder, and a
// drizzle schema (schema.ts or schema/*.ts under db/, drizzle/ or database/).
const SCHEMA_FILE = [
  /(^|\/)schema\.prisma$/, /(^|\/)models\.py$/, /(^|\/)schema\/(.*\/)?[^/]+\.sql$/,
  /(^|\/)(drizzle|db|database)\/(.*\/)?schema(\.ts|\/[^/]+\.ts)$/,
]

// A command that generates a migration file counts as creating one.
export const MIGRATION_COMMAND = inCommand(
  'prisma +migrate +(dev|diff)|drizzle-kit +generate(:\\w+)?|alembic +revision|(python3? +)?manage\\.py +makemigrations|(rails|rake) +(g|generate) +migration|supabase +migration +new|knex +migrate:make|dbmate +new|diesel +migration +generate',
)

const matches = (patterns: readonly RegExp[], path: string): boolean => patterns.some(pattern => pattern.test(path))

// "New" means a Write: an Edit of a migration is not a new migration. Once a
// migration exists in the session the rule stays quiet for the whole session.
export const create = (): Nudge => {
  let migrated = false
  let schemas: readonly string[] = []

  return {
    id: 'migration-nudge',
    observe: (e, ran) => {
      const edit = fileEdit(e, ran)
      if (edit !== undefined) {
        if (e.tool === 'Write' && matches(MIGRATION_FILE, edit.path)) migrated = true
        else if (matches(SCHEMA_FILE, edit.path) && !schemas.includes(edit.path)) schemas = [...schemas, edit.path]
      }
      if (e.tool === 'Bash' && ranOk(ran) && MIGRATION_COMMAND.test(e.command)) migrated = true
    },
    atStop: () => {
      if (migrated || schemas.length === 0) return undefined
      const names = schemas.join(', ')
      schemas = [] // one toast per batch of edits
      return `schema changed (${names}) and no migration file was created this session. Add a migration.`
    },
  }
}
