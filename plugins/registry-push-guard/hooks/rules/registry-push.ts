import type { GuardRule } from '../engine'
import { base, commandsOf, subcommandOf } from '../shell'

// A push puts an image or chart where every puller gets it, and a reused tag
// replaces the one in use. Pushes to a registry on this machine pass.
const DOCKER_VALUE_FLAGS = new Set(['-c', '--context', '-H', '--host', '-l', '--log-level', '--config', '--tlscacert', '--tlscert', '--tlskey', '--url', '--connection', '--root', '--runroot'])
const GCLOUD_VALUE_FLAGS = new Set(['--project', '--account', '--configuration', '--impersonate-service-account', '--verbosity', '--format'])
const LOCAL = /^(oci:\/\/)?(localhost|127\.[0-9.]+|\[::1\])([:/]|$)/

// docker and podman push options whose value is the next word.
const PUSH_VALUE_FLAGS = new Set(['--authfile', '--creds', '--format', '-f', '--sign-by', '--digestfile', '--cert-dir', '--platform'])
// A build output that pushes: type=registry, or push=true on any type.
const PUSHING_OUTPUT = /(^|,)(type=registry|push=true)(,|$)/

const isLocal = (target: string | undefined): boolean => target !== undefined && LOCAL.test(target)
// The destination: `podman push localhost/app docker://quay.io/app` pushes a
// local image to quay.io, so the last name counts, not the first.
const lastTarget = (args: readonly string[]): string | undefined =>
  args.filter((arg, i) => !arg.startsWith('-') && !PUSH_VALUE_FLAGS.has(args[i - 1] ?? '')).at(-1)
const outputsOf = (args: readonly string[]): readonly string[] =>
  args.flatMap((arg, i) => {
    if (arg === '-o' || arg === '--output') return args[i + 1] === undefined ? [] : [args[i + 1]!]
    const attached = /^(-o=?|--output=)(.+)$/.exec(arg)
    return attached === null ? [] : [attached[2]!]
  })
const pushesWithBuild = (args: readonly string[]): boolean =>
  args.some(arg => arg === '--push' || arg === '--push=true') || outputsOf(args).some(output => PUSHING_OUTPUT.test(output))

// docker and podman share their verbs.
const containerPush = (name: string, argv: readonly string[]): string | undefined => {
  const { sub, args } = subcommandOf(argv, DOCKER_VALUE_FLAGS)
  const [verb, ...rest] = args
  if (sub === 'push') return isLocal(lastTarget(args)) ? undefined : `${name} push`
  if (sub === 'image' && verb === 'push') return isLocal(lastTarget(rest)) ? undefined : `${name} push`
  if (sub === 'manifest' && verb === 'push') return isLocal(lastTarget(rest)) ? undefined : `${name} manifest push`
  const builds = sub === 'build' || (sub === 'buildx' && (verb === 'build' || verb === 'bake'))
  return builds && pushesWithBuild(args) ? `${name} buildx --push` : undefined
}

const pushOf = (argv: readonly string[]): string | undefined => {
  const name = argv[0] === undefined ? '' : base(argv[0])
  if (name === 'docker' || name === 'podman') return containerPush(name, argv)
  if (name === 'helm') {
    const { sub, args } = subcommandOf(argv, DOCKER_VALUE_FLAGS)
    const remote = args.filter(arg => !arg.startsWith('-'))[1]
    return sub === 'push' && !isLocal(remote) ? 'helm push' : undefined
  }
  if (name !== 'gcloud') return undefined
  const { sub, args } = subcommandOf(argv, GCLOUD_VALUE_FLAGS)
  return sub === 'artifacts' && args[0] === 'docker' && args[1] === 'push' ? 'gcloud artifacts docker push' : undefined
}

export const registryPushesIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => {
    const name = pushOf(argv)
    return name === undefined ? [] : [name]
  })
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'registry-push-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = registryPushesIn(e.command)
    return found.length === 0 ? undefined : `this pushes to a registry (${found.join(', ')}). Everyone who pulls the tag gets it, and a reused tag replaces the one in use.`
  },
}
