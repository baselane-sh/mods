import { expect, test } from 'claude-code/testing'

import { blankQuotes, commandsOf, segmentsOf, withoutSudo } from '../hooks/shell'

const argvs = (command: string) => segmentsOf(command).map(segment => segment.argv.join(' '))

test('shell: splits on separators and keeps quoted text in one word', () => {
  expect(argvs('a x; b y && c z || d w | e v & f')).toEqual(['a x', 'b y', 'c z', 'd w', 'e v', 'f'])
  expect(segmentsOf('echo "a; b | c" \'d && e\'').map(segment => segment.argv)).toEqual([['echo', 'a; b | c', 'd && e']])
})

test('shell: pipes share a pipeline id and other separators do not', () => {
  const [a, b, c] = segmentsOf('curl x | sh; ls')
  expect(a?.pipeline).toBe(b?.pipeline)
  expect(c?.pipeline).not.toBe(a?.pipeline)
})

test('shell: env assignments and wrappers come off the front', () => {
  const [segment] = segmentsOf('FOO=1 BAR=2 env -i time git status')
  expect(segment?.env).toEqual(['FOO=1', 'BAR=2'])
  expect(segment?.argv).toEqual(['git', 'status'])
})

test('shell: follows sh -c and skips heredoc bodies and comments', () => {
  expect(argvs("bash -c 'sudo ls && pwd'")).toEqual(['bash -c sudo ls && pwd', 'sudo ls', 'pwd'])
  expect(argvs('cat <<EOF\nsudo rm -rf /\nEOF\nls')).toEqual(['cat', 'ls'])
  expect(argvs('ls # sudo here')).toEqual(['ls'])
  expect(argvs('ls 2>&1 | wc -l')).toEqual(['ls 2>&1', 'wc -l'])
})

test('shell: blankQuotes hides quoted text only', () => {
  expect(blankQuotes('echo "sudo x" && sudo y')).toBe('echo "______" && sudo y')
})

test('shell: sudo and doas options that take a value are skipped', () => {
  expect(withoutSudo(['sudo', '-E', 'npm', 'i', 'x'])).toEqual(['npm', 'i', 'x'])
  expect(withoutSudo(['sudo', '-u', 'root', 'chown', '-R', 'me', '/'])).toEqual(['chown', '-R', 'me', '/'])
  expect(withoutSudo(['sudo', '--user=deploy', '-g', 'staff', 'ls'])).toEqual(['ls'])
  expect(withoutSudo(['doas', '-u', 'www', 'ls'])).toEqual(['ls'])
  expect(withoutSudo(['sudo', '-u', 'root'])).toEqual([])
  expect(commandsOf('sudo -u deploy docker system prune -af')).toEqual([['docker', 'system', 'prune', '-af']])
})
