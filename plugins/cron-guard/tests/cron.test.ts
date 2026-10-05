import { expect, test } from 'claude-code/testing'

import { cronDangersIn } from '../hooks/rules/cron'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['crontab -r', 'crontab -r'],
  ['crontab -ir', 'crontab -r'],
  ['crontab -u deploy -r', 'crontab -r'],
  ['(crontab -l; echo "0 * * * * job") | crontab -', 'crontab -'],
  ['echo "" | crontab -', 'crontab -'],
  ['crontab jobs.txt', 'crontab <file>'],
  ['launchctl unload ~/Library/LaunchAgents/com.acme.sync.plist', 'launchctl unload'],
  ['launchctl remove com.acme.sync', 'launchctl remove'],
  ['sudo launchctl bootout system/com.acme.agent', 'launchctl bootout'],
  ['launchctl disable gui/501/com.acme.sync', 'launchctl disable'],
  ['sudo systemctl stop nginx', 'systemctl stop'],
  ['systemctl disable --now postgresql', 'systemctl disable'],
  ['systemctl mask sshd.service', 'systemctl mask'],
  ['systemctl -H web1 stop nginx', 'systemctl stop'],
]
const MISSES = [
  'crontab -l',
  'crontab -e',
  'crontab -u deploy -l',
  'launchctl list',
  'launchctl load ~/Library/LaunchAgents/com.acme.sync.plist',
  'launchctl kickstart -k gui/501/com.acme.sync',
  'systemctl status nginx',
  'systemctl start nginx',
  'systemctl restart nginx',
  'systemctl --user stop syncthing',
  'systemctl --user disable --now syncthing',
  'systemctl list-units --failed',
  'echo "crontab -r"',
  'grep "systemctl stop" README.md',
]

test('cron-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: cronDangersIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: cronDangersIn(command) }).toEqual({ command, found: [] })
})

test('cron-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
