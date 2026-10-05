import type { ToolCallEnvelope } from 'claude-code'

import type { FileTouch, PaneLine } from '../../types'
import type { FileAction } from '../files'
import { clean, line, ruleLine } from '../lines'
import type { PaneRule } from '../rule'

// The files Claude read, edited or wrote this session, in one group per
// action, newest first. The engine keeps the ledger (`files: true`); this rule
// only draws it, so it runs no command and reads no file.
const MAX_PER_GROUP = 15

const FILE_TOOLS = new Set(['Read', 'Edit', 'MultiEdit', 'NotebookEdit', 'Write'])

const GROUPS: readonly { action: FileAction; title: string; color: string }[] = [
  { action: 'edits', title: 'Edited', color: 'yellow' },
  { action: 'writes', title: 'Wrote', color: 'green' },
  { action: 'reads', title: 'Read', color: 'cyan' },
]

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

// Inside the session's directory a path reads relative to it; elsewhere whole.
export const shownPath = (cwd: string, path: string): string => {
  const base = cwd.replace(/\/+$/, '')
  return base.length > 0 && path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path
}

const groupLines = (files: readonly FileTouch[], cwd: string, group: (typeof GROUPS)[number]): PaneLine[] => {
  const touched = files.filter(file => file[group.action] > 0)
  if (touched.length === 0) return []
  const rest = touched.length - MAX_PER_GROUP
  return [
    ruleLine(`rule-${group.action}`),
    line(group.action, { text: `${group.title} (${touched.length})`, bold: true, color: group.color }),
    ...touched
      .slice(0, MAX_PER_GROUP)
      .map(file => line(`${group.action}-${file.path}`, { text: `  ${clean(shownPath(cwd, file.path))}` }, { text: `  ×${file[group.action]}`, dim: true })),
    ...(rest > 0 ? [line(`${group.action}-more`, { text: `  … and ${rest} more`, dim: true })] : []),
  ]
}

export const filesLines = (ledger: readonly FileTouch[], cwd: string): PaneLine[] => {
  if (ledger.length === 0) return [line('none', { text: 'No file read, edited or written yet.', dim: true })]
  // The ledger keeps the newest touch last.
  const files = [...ledger].reverse()
  const count = (action: FileAction): number => files.filter(file => file[action] > 0).length
  return [
    line('count', {
      text: `${plural(files.length, 'file')} this session: ${count('edits')} edited, ${count('writes')} written, ${count('reads')} read`,
      bold: true,
    }),
    ...GROUPS.flatMap(group => groupLines(files, cwd, group)),
  ]
}

export const rule: PaneRule = {
  id: 'files-pane',
  pane: {
    id: 'files',
    title: 'Files',
    command: 'files',
    description: 'Show or hide the Files pane: the files Claude read, edited or wrote this session, grouped by action',
    empty: 'Reading the files of this session…',
  },
  files: true,
  refreshAfter: (e: ToolCallEnvelope) => FILE_TOOLS.has(String(e.tool)),
  load: async host => filesLines(await host.files(), await host.cwd()),
}
