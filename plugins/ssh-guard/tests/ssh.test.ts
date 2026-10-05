import { expect, test } from 'claude-code/testing'

import { keygenTargetsIn, rule, sshDangersIn } from '../hooks/rules/ssh'
import { NO_TOOLS } from './fixtures'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['cat ~/.ssh/id_rsa', 'read private key ~/.ssh/id_rsa'],
  ['cat /Users/me/.ssh/id_ed25519', 'read private key /Users/me/.ssh/id_ed25519'],
  ['base64 < ~/.ssh/id_ed25519', 'read private key ~/.ssh/id_ed25519'],
  ['pbcopy <~/.ssh/id_ecdsa', 'read private key ~/.ssh/id_ecdsa'],
  ['cp ~/.ssh/id_rsa /tmp/k', 'read private key ~/.ssh/id_rsa'],
  ['grep -c PRIVATE $HOME/.ssh/id_rsa', 'read private key $HOME/.ssh/id_rsa'],
  ['sudo cat /root/.ssh/id_ed25519', 'read private key /root/.ssh/id_ed25519'],
  ['echo "ssh-ed25519 AAAA me" >> ~/.ssh/authorized_keys', 'change ~/.ssh/authorized_keys'],
  ['cat key.pub >> ~/.ssh/authorized_keys', 'change ~/.ssh/authorized_keys'],
  ['tee -a ~/.ssh/config < host.conf', 'change ~/.ssh/config'],
  ['cp new_config ~/.ssh/config', 'change ~/.ssh/config'],
  ["sed -i '' 's/22/2222/' ~/.ssh/config", 'change ~/.ssh/config'],
  ['printf "Host x\\n" >~/.ssh/config', 'change ~/.ssh/config'],
  ['rm ~/.ssh/authorized_keys', 'change ~/.ssh/authorized_keys'],
  ['echo "ssh-rsa AAA me">>~/.ssh/authorized_keys', 'change ~/.ssh/authorized_keys'],
  ['cat key.pub>>~/.ssh/authorized_keys', 'change ~/.ssh/authorized_keys'],
  ['cat key.pub>> ~/.ssh/authorized_keys', 'change ~/.ssh/authorized_keys'],
  ['echo x>~/.ssh/config', 'change ~/.ssh/config'],
  ['base64<~/.ssh/id_rsa', 'read private key ~/.ssh/id_rsa'],
  ['mv ~/.ssh/authorized_keys /tmp/', 'change ~/.ssh/authorized_keys'],
  ['cat ~/.ssh/*', 'read private key ~/.ssh/*'],
  ['cat ~/.ssh/github_ed25519', 'read private key ~/.ssh/github_ed25519'],
  ['tar czf /tmp/k.tgz ~/.ssh', 'copy key folder ~/.ssh'],
  ['cp -r ~/.ssh /tmp/x', 'copy key folder ~/.ssh'],
  ['rsync -a ~/.ssh/ backup:keys/', 'copy key folder ~/.ssh/'],
  ['tar czf k.tgz -C ~ .ssh', 'copy key folder .ssh'],
]
const MISSES = [
  'cat ~/.ssh/id_rsa.pub',
  'ssh -i ~/.ssh/id_ed25519 web1',
  'ssh-add ~/.ssh/id_ed25519',
  'ssh-copy-id -i ~/.ssh/id_ed25519.pub web1',
  'chmod 600 ~/.ssh/id_rsa',
  'ls -la ~/.ssh',
  'cat ~/.ssh/config',
  'grep Host ~/.ssh/config',
  'cat ~/.ssh/known_hosts',
  'echo ~/.ssh/id_rsa',
  'GIT_SSH_COMMAND="ssh -i ~/.ssh/id_deploy" git fetch',
  'git commit -m "rotate ~/.ssh/id_rsa"',
  'cat docs/id_rsa_setup.md',
  'cp ~/.ssh/config /tmp/ssh-config.bak',
  'cat ~/.ssh/known_hosts.old',
  'cat ~/.ssh/*.pub',
  'chmod 600 ~/.ssh/*',
  'ls ~/.ssh/*',
  'mkdir -p ~/.ssh',
  'chmod 700 ~/.ssh',
  'echo "x>~/.ssh/authorized_keys"',
]

// HOME is /Users/me there. The keys that exist: id_ed25519 and id_rsa in
// ~/.ssh, and deploy_key in the repo.
const HOME = { 'printenv HOME': '/Users/me\n' }
const FILES = {
  '/Users/me/.ssh/id_ed25519': '/Users/me/.ssh/id_ed25519',
  '/Users/me/.ssh/id_rsa': '/Users/me/.ssh/id_rsa',
  '/repo/deploy_key': '/repo/deploy_key',
}
const KEYGEN_HITS = [
  'ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""',
  'ssh-keygen -t rsa -b 4096',
  'ssh-keygen',
  'yes | ssh-keygen -q -t ed25519 -N "" -f $HOME/.ssh/id_ed25519',
  'ssh-keygen -f deploy_key -N ""',
  'ssh-keygen -trsa -f/Users/me/.ssh/id_rsa',
]
const KEYGEN_MISSES = [
  'ssh-keygen -t ed25519 -f ~/.ssh/id_new -N ""',
  'ssh-keygen -t ecdsa',
  'ssh-keygen -l -f ~/.ssh/id_ed25519',
  'ssh-keygen -y -f ~/.ssh/id_ed25519 > ~/.ssh/id_ed25519.pub',
  'ssh-keygen -R web1',
  'ssh-keygen -p -f ~/.ssh/id_rsa',
]

const read = (file_path: string) => ({ tool: 'Read', file_path }) as const
const write = (file_path: string) => ({ tool: 'Write', file_path, content: 'x' }) as const
const edit = (file_path: string) => ({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) as const
const TOOL_HITS = [
  read('/Users/me/.ssh/id_ed25519'),
  write('/Users/me/.ssh/authorized_keys'),
  edit('/Users/me/.ssh/config'),
  write('/Users/me/.ssh/id_rsa'),
  read('/Users/me/.ssh/github_key'),
]
const TOOL_MISSES = [
  read('/Users/me/.ssh/id_ed25519.pub'),
  read('/Users/me/.ssh/config'),
  write('/repo/src/ssh/config.ts'),
  read('/repo/docs/id_rsa.md'),
  read('/Users/me/.ssh/known_hosts'),
]

test('ssh-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: sshDangersIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: sshDangersIn(command) }).toEqual({ command, found: [] })
})

test('ssh-guard: ssh-keygen targets, named or by default', () => {
  expect(keygenTargetsIn('ssh-keygen -t ed25519 -f ~/.ssh/work -C me')).toEqual(['~/.ssh/work'])
  expect(keygenTargetsIn('ssh-keygen -t rsa')).toEqual(['~/.ssh/id_rsa'])
  expect(keygenTargetsIn('ssh-keygen -t ed25519-sk')).toEqual(['~/.ssh/id_ed25519_sk'])
  expect(keygenTargetsIn('ssh-keygen')).toEqual(['~/.ssh/id_ed25519'])
  expect(keygenTargetsIn('ssh-keygen -lf ~/.ssh/id_rsa')).toEqual([])
  expect(keygenTargetsIn('ssh-keygen -F web1')).toEqual([])
})

test('ssh-guard: file tools ask on private keys and SSH access files', async () => {
  for (const args of TOOL_HITS) expect({ args, hit: (await rule.check({ ...args, tool_use_id: 't' }, NO_TOOLS)) !== undefined }).toEqual({ args, hit: true })
  for (const args of TOOL_MISSES) expect({ args, hit: (await rule.check({ ...args, tool_use_id: 't' }, NO_TOOLS)) !== undefined }).toEqual({ args, hit: false })
})

test('ssh-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on, { git: HOME, fs: FILES })
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
  for (const command of KEYGEN_HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of KEYGEN_MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
  for (const args of TOOL_HITS) expect({ args, answered: await guard.answeredTool(args) }).toEqual({ args, answered: true })
  for (const args of TOOL_MISSES) expect({ args, answered: await guard.answeredTool(args) }).toEqual({ args, answered: false })
})
