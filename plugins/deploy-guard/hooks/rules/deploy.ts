import type { GuardRule } from '../engine'
import { base, commandsOf, subcommandOf } from '../shell'

// Deploys that reach production users at once. Preview and staging deploys,
// dry runs and build-only runs pass.
const VALUE_FLAGS = new Set(['--project', '-P', '--account', '--configuration', '--config', '-c', '--token', '-t', '--cwd', '--scope', '-S', '--dir', '-d', '--app', '-a', '-r', '--region', '--verbosity', '--format', '--profile'])
const RUNNERS = new Set(['npx', 'bunx', 'pnpx'])
const RUNS_AFTER: Readonly<Record<string, string>> = { pnpm: 'exec', yarn: 'exec', npm: 'exec', bun: 'x' }
const PROD_STAGE = /^prod(uction)?$/i
// A firebase deploy whose every --only target is a hosting target named for
// previews, such as hosting:preview.
const PREVIEW_ONLY = /^hosting:[^,]*preview[^,]*$/i

// `npx vercel` and `pnpm exec vercel` read as `vercel`.
const withoutRunner = (argv: readonly string[]): readonly string[] => {
  const name = argv[0] === undefined ? '' : base(argv[0])
  const from = RUNNERS.has(name) ? 1 : RUNS_AFTER[name] !== undefined && argv[1] === RUNS_AFTER[name] ? 2 : 0
  if (from === 0) return argv
  const rest = argv.slice(from)
  const start = rest.findIndex(word => !word.startsWith('-'))
  return start < 0 ? [] : rest.slice(start)
}

const valueOf = (args: readonly string[], names: readonly string[]): string | undefined => {
  for (const [i, arg] of args.entries()) {
    if (names.includes(arg)) return args[i + 1]
    const name = names.find(n => n.startsWith('--') && arg.startsWith(`${n}=`))
    if (name !== undefined) return arg.slice(name.length + 1)
  }
  return undefined
}

const firebaseDanger = (args: readonly string[]): string | undefined => {
  if (args.includes('--dry-run')) return undefined
  const only = valueOf(args, ['--only'])
  const isPreview = only !== undefined && only.split(',').every(target => PREVIEW_ONLY.test(target))
  return isPreview ? undefined : 'firebase deploy'
}

const vercelDanger = (args: readonly string[]): string | undefined => {
  const isProd = args.some(arg => arg === '--prod' || arg === '--prod=true') || valueOf(args, ['--target']) === 'production'
  return isProd ? 'vercel --prod' : undefined
}

const dangerOf = (argv: readonly string[]): string | undefined => {
  const name = argv[0] === undefined ? '' : base(argv[0])
  const { sub, args } = subcommandOf(argv, VALUE_FLAGS)
  if (name === 'vercel') return vercelDanger(argv.slice(1))
  if (name === 'netlify' && sub === 'deploy') {
    return args.some(arg => arg === '--prod' || arg === '--prod-if-unlocked') ? 'netlify deploy --prod' : undefined
  }
  if ((name === 'firebase' || name === 'firebase-tools') && sub === 'deploy') return firebaseDanger(args)
  if ((name === 'fly' || name === 'flyctl') && sub === 'deploy') return args.includes('--build-only') ? undefined : 'fly deploy'
  if (name === 'gcloud' && sub === 'app' && args[0] === 'deploy') return 'gcloud app deploy'
  if (name === 'eb' && sub === 'deploy') return 'eb deploy'
  if (name === 'heroku' && (sub === 'releases:rollback' || sub === 'rollback')) return 'heroku releases:rollback'
  if ((name === 'serverless' || name === 'sls') && sub === 'deploy') {
    const stage = valueOf(args, ['--stage', '-s'])
    return stage !== undefined && PROD_STAGE.test(stage) ? 'serverless deploy --stage prod' : undefined
  }
  return undefined
}

export const deploysIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => {
    const danger = dangerOf(withoutRunner(argv))
    return danger === undefined ? [] : [danger]
  })
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'deploy-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = deploysIn(e.command)
    return found.length === 0 ? undefined : `this deploys to production (${found.join(', ')}). Users see the change at once.`
  },
}
