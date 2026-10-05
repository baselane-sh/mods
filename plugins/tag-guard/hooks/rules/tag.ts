import type { GuardRule } from '../engine'
import { GIT_VALUE_FLAGS, openRepo } from '../git'
import { base, commandsOf, hasShortFlag, subcommandOf } from '../shell'

// Release tags on a remote are fetched by others and built from; moving or
// deleting one breaks their builds. A bare refspec (`git push origin v1.2.0`)
// counts as a tag when the repo has a local tag of that name, or the same
// command deleted one (`git tag -d v1 && git push origin :v1`). Dry runs,
// local tag commands and branch pushes pass. git-history-guard also asks on
// every remote delete; the first guard that asks answers for the rest.
const PUSH_VALUE_FLAGS = new Set(['--repo', '-o', '--push-option', '--receive-pack', '--exec'])
const WHOLE_PUSHES = ['--tags', '--follow-tags', '--mirror']
const TAGS = 'refs/tags/'

type Git = { sub: string | undefined; args: readonly string[] }

const has = (args: readonly string[], long: string, letter: string): boolean =>
  args.some(arg => arg === long || hasShortFlag(arg, letter))

const positionals = (args: readonly string[]): readonly string[] =>
  args.filter((arg, i) => !arg.startsWith('-') && !PUSH_VALUE_FLAGS.has(args[i - 1] ?? ''))

type Ref = { name: string; deletes: boolean; isTag: boolean }

// The names a refspec list pushes or deletes. `tag v1` is a tag by syntax.
const refsOf = (refspecs: readonly string[], deletes: boolean): readonly Ref[] =>
  refspecs.flatMap((spec, i) => {
    if (spec === 'tag') return []
    if (refspecs[i - 1] === 'tag') return [{ name: spec, deletes, isTag: true }]
    const bare = spec.replace(/^\+/, '')
    const ref = bare.startsWith(':') ? { name: bare.slice(1), deletes: true } : { name: bare.split(':')[0] ?? bare, deletes }
    return [{ ...ref, isTag: ref.name.startsWith(TAGS) }]
  })

const pushDangers = async (args: readonly string[], deleted: ReadonlySet<string>, isTag: (name: string) => Promise<boolean>): Promise<readonly string[]> => {
  if (has(args, '--dry-run', 'n')) return []
  const whole = WHOLE_PUSHES.filter(flag => args.includes(flag)).map(flag => `git push ${flag}`)
  const refs = refsOf(positionals(args).slice(1), has(args, '--delete', 'd'))
  const named = await Promise.all(
    refs.map(async ({ name, deletes, isTag: bySyntax }) => {
      const tagged = bySyntax || deleted.has(name) || (name !== 'HEAD' && name.length > 0 && (await isTag(name)))
      if (!tagged) return []
      return [deletes ? `delete remote tag ${name}` : `push tag ${name}`]
    }),
  )
  return [...whole, ...named.flat()]
}

// `isTag` answers whether the repo holds a local tag of that name.
export const tagDangersIn = async (command: string, isTag: (name: string) => Promise<boolean>): Promise<readonly string[]> => {
  const gits: readonly Git[] = commandsOf(command)
    .filter(argv => argv[0] !== undefined && base(argv[0]) === 'git')
    .map(argv => subcommandOf(argv, GIT_VALUE_FLAGS))
  const deleted = new Set(
    gits.filter(git => git.sub === 'tag' && has(git.args, '--delete', 'd')).flatMap(git => git.args.filter(arg => !arg.startsWith('-'))),
  )
  const found = await Promise.all(gits.filter(git => git.sub === 'push').map(git => pushDangers(git.args, deleted, isTag)))
  return [...new Set(found.flat())]
}

export const rule: GuardRule = {
  id: 'tag-guard',
  decision: 'ask',
  check: async (e, tools) => {
    if (e.tool !== 'Bash') return undefined
    const command = e.command
    const repo = /\bgit\b/.test(command) && /\bpush\b/.test(command) ? await openRepo(command, tools) : undefined
    const isTag = async (name: string) =>
      repo !== undefined && (await repo.git('show-ref', '--verify', '--quiet', `${TAGS}${name}`)) !== undefined
    const found = await tagDangersIn(command, isTag)
    return found.length === 0 ? undefined : `this changes release tags on a remote (${found.join(', ')}). Others may have fetched them already, and a moved or deleted tag breaks their builds.`
  },
}
