import type { GuardRule } from '../engine'
import { base, commandsOf, hasShortFlag, subcommandOf } from '../shell'

// Docker commands that delete data no rebuild brings back: volumes, images
// and running containers. Reads, plain `docker rm` of a stopped container
// and `compose down` without -v pass.
const DOCKER_VALUE_FLAGS = new Set(['-c', '--context', '-H', '--host', '-l', '--log-level', '--config', '--tlscacert', '--tlscert', '--tlskey'])
const COMPOSE_VALUE_FLAGS = new Set(['-f', '--file', '-p', '--project-name', '--project-directory', '--env-file', '--profile', '--ansi', '--parallel', '--progress'])
const PRUNED = new Set(['system', 'volume', 'image'])

const isForce = (word: string): boolean => word === '--force' || hasShortFlag(word, 'f')

const composeDanger = (argv: readonly string[]): string[] => {
  const { sub, args } = subcommandOf(argv, COMPOSE_VALUE_FLAGS)
  const dropsVolumes = args.some(arg => arg === '-v' || arg === '--volumes' || arg === '--volumes=true')
  return sub === 'down' && dropsVolumes ? ['docker compose down -v'] : []
}

const dockerDanger = (argv: readonly string[]): string[] => {
  const { sub, args } = subcommandOf(argv, DOCKER_VALUE_FLAGS)
  const [verb, ...rest] = args
  if (sub === 'compose') return composeDanger([sub, ...args])
  if (sub !== undefined && PRUNED.has(sub) && verb === 'prune') return [`docker ${sub} prune`]
  if (sub === 'volume' && (verb === 'rm' || verb === 'remove')) return ['docker volume rm']
  const rmArgs = sub === 'rm' ? args : sub === 'container' && (verb === 'rm' || verb === 'remove') ? rest : undefined
  return rmArgs?.some(isForce) ? ['docker rm -f'] : []
}

export const dockerDangersIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => {
    const name = argv[0] === undefined ? undefined : base(argv[0])
    if (name === 'docker') return dockerDanger(argv)
    return name === 'docker-compose' ? composeDanger(argv) : []
  })
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'docker-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = dockerDangersIn(e.command)
    return found.length === 0 ? undefined : `this deletes Docker data that a rebuild does not bring back (${found.join(', ')}).`
  },
}
