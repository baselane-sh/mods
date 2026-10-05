import type { BandRule } from '../rule'

// Commits ahead of and behind the upstream. It rides the engine's git read
// (after a Bash call or a file edit), so it runs no command of its own. A
// branch with no upstream has no counts and the segment is hidden.
export const rule: BandRule = {
  id: 'ahead-behind',
  tracksGit: true,
  segment: ({ git }) =>
    git?.ahead === undefined || git.behind === undefined
      ? undefined
      : { key: 'ahead-behind', text: `↑${git.ahead} ↓${git.behind}` },
}
