import type { BandRule } from '../rule'

// `git grep -c` prints `path:count` per file. Exit 1 with no output is no match.
export const sumCounts = (stdout: string): number =>
  stdout
    .split('\n')
    .reduce((sum, line) => sum + (Number(/:(\d+)$/.exec(line)?.[1]) || 0), 0)

// Lines with TODO, FIXME or HACK as a whole word, in the files git tracks. It
// reads the repository after a Bash call or a file edit, and every five
// minutes besides, for edits made elsewhere. None found: hidden.
export const rule: BandRule = {
  id: 'todo-count',
  fetch: {
    everyMs: 300_000,
    onEdit: true,
    timeoutMs: 5000,
    read: async run => {
      const ran = await run(['git', '--no-optional-locks', 'grep', '-c', '--no-color', '-I', '-w', '-E', 'TODO|FIXME|HACK'])
      const count = ran.exitCode === 0 ? sumCounts(ran.stdout) : 0
      return count > 0 ? { text: `todo ${count}` } : null
    },
  },
  segment: ({ fetched }) => {
    const found = fetched['todo-count']
    return found === null || found === undefined ? undefined : { key: 'todo-count', ...found }
  },
}
