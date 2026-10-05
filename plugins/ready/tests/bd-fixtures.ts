// Trimmed from real `bd ... --json` answers (bd 1.2.2, read only).
export const bead = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Title of ${id}`,
  description: 'one line',
  status: 'open',
  priority: 1,
  issue_type: 'task',
  created_at: '2026-10-01T10:00:00Z',
  labels: [],
  ...over,
})

export const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n'

export const NO_PROJECT_ERR = "Error: no beads database found\nHint: run 'bd where' to inspect the resolved workspace\n"
