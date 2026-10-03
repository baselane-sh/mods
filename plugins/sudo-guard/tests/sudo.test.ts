import { expect, test } from 'claude-code/testing'

import { usesPrivilege } from '../hooks/rules/sudo'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['sudo rm -rf /var/log/x', 'sudo'],
  ['cd /etc && sudo vim hosts', 'sudo'],
  ['ls | sudo tee /etc/hosts', 'sudo'],
  ['/usr/bin/sudo -n true', 'sudo'],
  ['env FOO=1 sudo make install', 'sudo'],
  ['bash -c "sudo apt-get update"', 'sudo'],
  ['doas pkg_add vim', 'doas'],
  ['su -c "systemctl restart nginx"', 'su -c'],
  ['su root -c "id"', 'su -c'],
  ['su --command "id"', 'su -c'],
]
const MISSES = [
  'grep sudo README.md',
  'echo "run it with sudo"',
  'man sudo',
  'which sudo',
  'apt-get install sudo',
  'cat /etc/sudoers.d/x',
  'git commit -m "no longer needs sudo"',
  'ssh host sudo ls',
  'echo pseudo',
  'su',
  'cat <<EOF\nsudo rm x\nEOF',
]

test('sudo-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: usesPrivilege(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: usesPrivilege(command) }).toEqual({ command, found: [] })
})

test('sudo-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
