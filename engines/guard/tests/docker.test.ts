import { expect, test } from 'claude-code/testing'

import { dockerDangersIn } from '../hooks/rules/docker'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['docker system prune', 'docker system prune'],
  ['docker system prune -af --volumes', 'docker system prune'],
  ['docker volume prune -f', 'docker volume prune'],
  ['docker image prune -a', 'docker image prune'],
  ['docker rm -f web', 'docker rm -f'],
  ['docker rm --force web', 'docker rm -f'],
  ['docker rm -fv web', 'docker rm -f'],
  ['docker container rm -f web', 'docker rm -f'],
  ['docker rm -f $(docker ps -aq)', 'docker rm -f'],
  ['docker ps -aq | xargs docker rm -f', 'docker rm -f'],
  ['docker volume rm pgdata', 'docker volume rm'],
  ['docker volume remove pgdata', 'docker volume rm'],
  ['docker compose down -v', 'docker compose down -v'],
  ['docker compose down --volumes', 'docker compose down -v'],
  ['docker compose -f prod.yml -p shop down -v', 'docker compose down -v'],
  ['docker-compose down -v', 'docker compose down -v'],
  ['docker --context prod system prune -f', 'docker system prune'],
  ['docker -H tcp://host:2375 volume rm data', 'docker volume rm'],
  ['sudo docker system prune -af', 'docker system prune'],
  ['echo "$(docker system prune -af)"', 'docker system prune'],
  ['eval "docker volume rm pgdata"', 'docker volume rm'],
  ['cd app && docker compose down -v', 'docker compose down -v'],
  ['docker ps; docker volume prune -f', 'docker volume prune'],
  ['bash -c "docker system prune -af"', 'docker system prune'],
]
const MISSES = [
  'docker ps',
  'docker ps -a',
  'docker rm web',
  'docker rmi web:old',
  'docker run -v data:/data app',
  'docker logs -f web',
  'docker volume ls',
  'docker volume create pgdata',
  'docker image ls',
  'docker compose down',
  'docker compose up -d',
  'docker compose run -v ./src:/src app',
  'docker compose -f prod.yml logs -f',
  'echo "docker system prune -af"',
  'grep "volume rm" notes.md',
  'cat <<EOF\ndocker system prune -af\nEOF',
]

test('docker-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: dockerDangersIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: dockerDangersIn(command) }).toEqual({ command, found: [] })
})

test('docker-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
