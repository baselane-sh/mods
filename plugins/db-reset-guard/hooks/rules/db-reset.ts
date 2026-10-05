import type { GuardRule } from '../engine'
import { base, commandsOf, subcommandOf } from '../shell'

// Framework commands that drop, wipe or roll back a whole database. Raw SQL
// is prod-db-guard's (DELETE, UPDATE, TRUNCATE) and infra-guard's (DROP), so
// a pack holding all three asks once per command. Migrating forward, seeding
// and a one-step rollback pass.
const TOOLS = new Set(['prisma', 'rails', 'rake', 'alembic', 'django-admin', 'django', 'supabase', 'knex'])
const RUNNERS = new Set(['npx', 'bunx', 'pnpx'])
const RUNS_AFTER: Readonly<Record<string, readonly string[]>> = {
  pnpm: ['exec', 'dlx'], yarn: ['exec', 'dlx'], npm: ['exec'], bun: ['x'],
  uv: ['run'], poetry: ['run'], pipenv: ['run'], bundle: ['exec'],
}
const PYTHON = /^python[0-9.]*$/
const RAILS_TASKS = new Set(['db:drop', 'db:drop:all', 'db:reset', 'db:migrate:reset', 'db:purge', 'db:purge:all', 'db:truncate_all'])
const VALUE_FLAGS = new Set(['-c', '--config', '-n', '--name', '-x', '--workdir', '--profile', '--knexfile', '--env', '--cwd', '--client', '--connection', '--migrations-directory'])

// `npx prisma`, `pnpm prisma`, `bundle exec rails` and `python -m django`
// read as the tool itself.
const withoutRunner = (argv: readonly string[]): readonly string[] => {
  const name = argv[0] === undefined ? '' : base(argv[0])
  if (PYTHON.test(name) && argv[1] === '-m') return argv.slice(2)
  const runsBin = (name === 'pnpm' || name === 'yarn') && TOOLS.has(argv[1] ?? '')
  const from = RUNNERS.has(name) || runsBin ? 1 : RUNS_AFTER[name]?.includes(argv[1] ?? '') ? 2 : 0
  if (from === 0) return argv
  const rest = argv.slice(from)
  const start = rest.findIndex(word => !word.startsWith('-'))
  return start < 0 ? [] : rest.slice(start)
}

const dangerOf = (argv: readonly string[]): string | undefined => {
  const name = argv[0] === undefined ? '' : base(argv[0])
  const { sub, args } = subcommandOf(argv, VALUE_FLAGS)
  if (name === 'prisma' && sub === 'migrate' && args[0] === 'reset') return 'prisma migrate reset'
  if (name === 'prisma' && sub === 'db' && args[0] === 'push' && args.includes('--force-reset')) return 'prisma db push --force-reset'
  if (name === 'rails' || name === 'rake') {
    const task = argv.slice(1).find(word => RAILS_TASKS.has(word))
    return task === undefined ? undefined : `${name} ${task}`
  }
  if (name === 'alembic' && sub === 'downgrade') return args.includes('--sql') ? undefined : 'alembic downgrade'
  const isManage = PYTHON.test(name) && argv[1] !== undefined && base(argv[1]) === 'manage.py' && argv[2] === 'flush'
  if (isManage || ((name === 'django-admin' || name === 'django') && sub === 'flush')) return 'django flush'
  if (name === 'supabase' && sub === 'db' && args[0] === 'reset') return 'supabase db reset'
  return name === 'knex' && sub === 'migrate:rollback' && args.includes('--all') ? 'knex migrate:rollback --all' : undefined
}

export const dbResetsIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => {
    const danger = dangerOf(withoutRunner(argv))
    return danger === undefined ? [] : [danger]
  })
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'db-reset-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = dbResetsIn(e.command)
    return found.length === 0 ? undefined : `this drops, wipes or rolls back a whole database (${found.join(', ')}). Check it is not production and that you have a backup.`
  },
}
