import type { StyleRule } from '../engine'

export const rule: StyleRule = {
  id: 'conventional-commits',
  section:
    'Style: Conventional Commits. Write every commit message (and squash or merge message) as type(scope): subject. The type is one of feat, fix, docs, style, refactor, perf, test, build, ci, chore or revert. The scope is optional. The subject is imperative ("add", not "added"), has no final period, and the whole first line is under 72 characters. Add a body after a blank line only when the why is not obvious. Mark a breaking change with ! after the type or a BREAKING CHANGE: footer. This applies only to commit messages.',
}
