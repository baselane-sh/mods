import type { BandRule } from '../rule'

// The git branch and how many files differ from HEAD. The engine reads git
// after a Bash call or a file edit, so the figure is as fresh as the last one.
export const rule: BandRule = {
  id: 'branch-band',
  tracksGit: true,
  segment: ({ git }) =>
    git === null
      ? undefined
      : { key: 'branch-band', text: `${git.branch} · ${git.changed === 0 ? 'clean' : `${git.changed} changed`}` },
}
