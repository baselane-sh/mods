import { expect, test } from 'claude-code/testing'

import { closesBead } from '../hooks/bead'

const CLOSES = [
  'bd close bm-1',
  'bd close a b c',
  'bd done bm-1',
  'bd -C /repo close bm-1',
  'bd --directory /repo close bm-1',
  'bd --actor "Ann Lee" close bm-1 -r "all done"',
  'bd --json close bm-1',
  'cd /repo && bd close bm-1',
  'git push; bd close bm-1 && echo ok',
  'BEADS_ACTOR=x bd close bm-1',
  '/opt/homebrew/bin/bd close bm-1',
  'echo hi | bd close bm-1',
  'if true; then bd close bm-1; fi',
  'bd close bm-1\nbd close bm-2',
  'echo $(bd close bm-1)',
]

const NOT_CLOSES = [
  'bd ready',
  'bd list --status closed',
  'bd show bm-1',
  'bd update bm-1 --status closed',
  'echo "bd close bm-1"',
  "echo 'bd close bm-1' && ls",
  'git commit -m "bd close bm-1"',
  'grep "bd close" notes.md',
  'bd close --help',
  'bd close -h',
  'bd --readonly close bm-1',
  'bd -C close',
  'cat <<EOF\nbd close bm-1\nEOF',
  "cat <<'EOF' > note.sh\nbd close bm-1\nEOF",
  'abd close bm-1',
  'bd closed bm-1',
  'ls ~/bd close',
  '',
]

test('bead: lines that close a bead', () => {
  for (const command of CLOSES) expect({ command, closes: closesBead(command) }).toEqual({ command, closes: true })
})

test('bead: lines that do not close a bead', () => {
  for (const command of NOT_CLOSES) expect({ command, closes: closesBead(command) }).toEqual({ command, closes: false })
})
