import { expect, test } from 'claude-code/testing'

import { chmodDangersIn } from '../hooks/rules/chmod'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['chmod 777 run.sh', 'world-writable chmod 777'],
  ['chmod 0777 /var/www/app', 'world-writable chmod 0777'],
  ['chmod 666 data.db', 'world-writable chmod 666'],
  ['chmod -R 777 storage', 'world-writable chmod 777'],
  ['chmod a+w notes.txt', 'world-writable chmod a+w'],
  ['chmod o+w notes.txt', 'world-writable chmod o+w'],
  ['chmod a=rwx notes.txt', 'world-writable chmod a=rwx'],
  ['chmod u+x,o+w notes.txt', 'world-writable chmod u+x,o+w'],
  ['find . -type f | xargs chmod 666', 'world-writable chmod 666'],
  ['cd app && chmod 777 .', 'world-writable chmod 777'],
  ['bash -c "chmod 777 run.sh"', 'world-writable chmod 777'],
  ['chmod -R 755 /', 'recursive chmod on /'],
  ['chmod -R u+rwX ~', 'recursive chmod on ~'],
  ['chmod --recursive 755 /usr', 'recursive chmod on /usr'],
  ['chmod -Rf 700 /Users/me/', 'recursive chmod on /Users/me/'],
  ['chown -R me /usr/local', 'recursive chown on /usr/local'],
  ['chown -R me:staff ~', 'recursive chown on ~'],
  ['chown -R me $HOME', 'recursive chown on $HOME'],
  ['chown -hR me /home/me', 'recursive chown on /home/me'],
  ['sudo chown -R root /etc', 'recursive chown on /etc'],
]
const MISSES = [
  'chmod +x run.sh',
  'chmod +w notes.txt',
  'chmod 755 bin/run',
  'chmod 644 README.md',
  'chmod 775 shared',
  'chmod go-w notes.txt',
  'chmod o-rwx notes.txt',
  'chmod -R 755 ./dist',
  'chmod -R u+rw src',
  'chmod -R 700 ~/.ssh',
  'chmod 755 /usr/local/bin/tool',
  'chown me notes.txt',
  'chown me /usr/local',
  'chown -R me ./build',
  'chown -R me /tmp/build',
  'chown -R me /Users/me/project',
  'echo "chmod 777 run.sh"',
  'ls -la | grep 777',
]

test('chmod-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: chmodDangersIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: chmodDangersIn(command) }).toEqual({ command, found: [] })
})

test('chmod-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
