import type { GuardRule } from '../engine'
import { base, commandsOf, subcommandOf } from '../shell'

// A push puts an image or chart where every puller gets it, and a reused tag
// replaces the one in use. Pushes to a registry on this machine pass.
const DOCKER_VALUE_FLAGS = new Set(['-c', '--context', '-H', '--host', '-l', '--log-level', '--config', '--tlscacert', '--tlscert', '--tlskey', '--url', '--connection', '--root', '--runroot'])
const GCLOUD_VALUE_FLAGS = new Set(['--project', '--account', '--configuration', '--impersonate-service-account', '--verbosity', '--format'])
const LOCAL = /^(oci:\/\/)?(localhost|127\.[0-9.]+|\[::1\])([:/]|$)/

const isLocal = (target: string | undefined): boolean => target !== undefined && LOCAL.test(target)
const firstTarget = (args: readonly string[]): string | undefined => args.find(arg => !arg.startsWith('-'))
const pushesWithBuild = (args: readonly string[]): boolean =>
  args.some(arg => arg === '--push' || arg === '--push=true' || /^(-o|--output)=?type=registry/.test(arg)) ||
  args.some((arg, i) => (arg === '-o' || arg === '--output') && args[i + 1]?.startsWith('type=registry') === true)

// docker and podman share their verbs.
const containerPush = (name: string, argv: readonly string[]): string | undefined => {
  const { sub, args } = subcommandOf(argv, DOCKER_VALUE_FLAGS)
  const [verb, ...rest] = args
  if (sub === 'push') return isLocal(firstTarget(args)) ? undefined : `${name} push`
  if (sub === 'image' && verb === 'push') return isLocal(firstTarget(rest)) ? undefined : `${name} push`
  if (sub === 'manifest' && verb === 'push') return isLocal(firstTarget(rest)) ? undefined : `${name} manifest push`
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
