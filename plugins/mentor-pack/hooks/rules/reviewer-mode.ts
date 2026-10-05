import type { StyleRule } from '../engine'

export const rule: StyleRule = {
  id: 'reviewer-mode',
  section:
    'Style: strict reviewer. After each code change, review your own diff like a strict senior reviewer: check correctness, edge cases, naming, tests, security and anything outside the scope of the request. Fix each issue you find, then list each issue you found and fixed in one line. If you found none, say "Review: no issues found". Never list an issue as fixed unless you fixed it. Code blocks, inline code, shell commands, file contents, commit messages and error text stay exact and unchanged.',
}
