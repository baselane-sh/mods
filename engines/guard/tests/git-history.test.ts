import { expect, test } from 'claude-code/testing'

import { historyDangersIn } from '../hooks/rules/git-history'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['git reset --hard', 'git reset --hard'],
  ['git reset --hard origin/main', 'git reset --hard'],
  ['git -C sub reset --hard HEAD~3', 'git reset --hard'],
  ['git fetch && git reset --hard origin/main', 'git reset --hard'],
  ['git clean -fdx', 'git clean'],
  ['git clean -fd', 'git clean'],
  ['git clean -f', 'git clean'],
  ['git clean --force -d', 'git clean'],
  ['git rebase main', 'git rebase'],
  ['git rebase -i HEAD~5', 'git rebase'],
  ['git -c core.editor=true rebase --onto main feat', 'git rebase'],
  ['git filter-branch --tree-filter "rm x" HEAD', 'git filter-branch'],
  ['git filter-repo --path secrets --invert-paths', 'git filter-repo'],
  ['git push --delete origin feat/x', 'git push --delete'],
  ['git push origin -d feat/x', 'git push --delete'],
  ['git push origin :feat/x', 'git push --delete'],
  ['git branch -D feat/x', 'git branch -D'],
  ['git branch --delete --force feat/x', 'git branch -D'],
  ['git branch -d -f feat/x', 'git branch -D'],
  ['git branch -df feat/x', 'git branch -D'],
  ['git branch --merged | grep -v main | xargs git branch -D', 'git branch -D'],
  ['git status; git stash clear', 'git stash clear'],
  ['git --no-pager stash clear', 'git stash clear'],
  ['bash -c "git reset --hard"', 'git reset --hard'],
  ['echo "$(echo ")")" && git reset --hard', 'git reset --hard'],
  ['echo "$((1<<2))"\ngit reset --hard', 'git reset --hard'],
  ['echo "$((1<<2))" && git reset --hard', 'git reset --hard'],
  ['echo "$(git log -1 --format="%s (%h")" && git reset --hard', 'git reset --hard'],
  ['echo "$(echo "(")" && git reset --hard', 'git reset --hard'],
  ['eval \'git reset --hard\'', 'git reset --hard'],
  ['bash -c "echo \\"$(git reset --hard)\\""', 'git reset --hard'],
  ['echo "$((1 + $(git reset --hard)))"', 'git reset --hard'],
]
const MISSES = [
  'cat <<2\ngit reset --hard\n2',
  'echo "$(cat <<2\ngit reset --hard\n2\n)"',
  `git commit -m "$(cat <<'EOF'\n1) the reader\nrun \`git reset --hard\` later\nEOF\n)"`,
  `git commit -m "$(cat <<'EOF'\ndon't break (it's a test) and \`git reset --hard\`\nEOF\n)"`,
  `git commit -m "$(cat <<'EOF'\nsmile :)\n\`git reset --hard\`\nEOF\n)"`,
  `git commit -m "$(cat <<"EOF"\n- a) first \`git reset --hard\`\nEOF\n)"`,
  'git commit -m "fix $(date)"',
  'echo "$(git status)"',
  'eval "$(ssh-agent -s)"',

  'git rebase --abort',
  'git rebase --continue',
  'git rebase --skip',
  'git rebase --quit',
  'git pull --rebase',
  'git config pull.rebase true',
  'git reset',
  'git reset --soft HEAD~1',
  'git reset HEAD src/app.ts',
  'git clean -n',
  'git clean -nd',
  'git clean --dry-run -fd',
  'git branch',
  'git branch -d feat/x',
  'git push origin feat/x',
  'git push origin HEAD:refs/heads/feat/x',
  'git stash',
  'git stash pop',
  'git stash list',
  'git log --oneline',
  'git checkout -b feat/x',
  'echo "git reset --hard"',
  'git commit -m "undo the git reset --hard"',
  'grep -r "rebase" docs',
]

test('git-history-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: historyDangersIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: historyDangersIn(command) }).toEqual({ command, found: [] })
})

test('git-history-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
