import type { GuardRule } from '../engine'

// A migration that already exists may have run on other databases. Changing
// it splits their schema from the one the code expects; the fix is a new
// migration. New migration files pass. Only Write and Edit are watched.
//
// Migration folders: any `migrations`, Rails `db/migrate`, Flyway
// `db/migration` and Alembic `alembic/versions`. The file's own name does
// not count, so `src/migrations.ts` passes.
const WATCHED = new Set<string>(['Write', 'Edit'])
const UNDER_DB = new Set(['migrate', 'migration'])

const folderNames = (path: string): readonly string[] =>
  path.replace(/\\/g, '/').split('/').filter(name => name.length > 0).slice(0, -1)

export const inMigrationsFolder = (path: string): boolean =>
  folderNames(path).some((name, i, names) => {
    const parent = names[i - 1]
    return name === 'migrations' || (parent === 'db' && UNDER_DB.has(name)) || (parent === 'alembic' && name === 'versions')
  })

// Folders above the project do not count: a repo cloned into ~/migrations
// holds no migrations by that name alone.
const insideOf = (path: string, dir: string): string => (path.startsWith(`${dir}/`) ? path.slice(dir.length + 1) : path)

export const rule: GuardRule = {
  id: 'migration-guard',
  decision: 'ask',
  check: async (e, tools) => {
    if (!WATCHED.has(String(e.tool)) || !('file_path' in e) || typeof e.file_path !== 'string') return undefined
    const cwd = await tools.cwd()
    const path = e.file_path.startsWith('/') ? e.file_path : `${cwd}/${e.file_path}`
    const real = await tools.realPath(path)
    if (real === undefined) return undefined
    const realCwd = (await tools.realPath(cwd)) ?? cwd
    return inMigrationsFolder(insideOf(path, cwd)) || inMigrationsFolder(insideOf(real, realCwd))
      ? `${e.file_path} is a migration that already exists and may have run elsewhere. Add a new migration instead of changing it.`
      : undefined
  },
}
