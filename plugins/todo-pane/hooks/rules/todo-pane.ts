import type { ProcessRunResult, ToolCallEnvelope } from 'claude-code'

import type { PaneCell, PaneLine } from '../../types'
import { clean, line } from '../lines'
import type { PaneRule } from '../rule'

// The TODO, FIXME and HACK lines of the tracked files under the session's
// directory, read with `git grep`. `-z` puts a NUL after the path and the line
// number, so a path with a colon or a space stays whole and unquoted; `-w`
// takes whole words only, so TODOS is not a marker; `-I` skips binary files.
const MARKERS = 'TODO|FIXME|HACK'
const MARKER = /\b(TODO|FIXME|HACK)\b/
const MAX_MARKERS = 30

export type Tag = 'TODO' | 'FIXME' | 'HACK'
export type Marker = { path: string; line: number; tag: Tag; text: string }

const COLORS: Record<Tag, string> = { TODO: 'yellow', FIXME: 'red', HACK: 'magenta' }
const TAGS: readonly Tag[] = ['TODO', 'FIXME', 'HACK']

const WRITES = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

const refreshAfter = (e: ToolCallEnvelope): boolean => WRITES.has(String(e.tool))

// One marker per line of `git grep -z -n` output, in git's order (by path).
// The text kept is from the marker word on: the comment mark before it says
// nothing.
export const parseMarkers = (stdout: string): Marker[] =>
  stdout.split('\n').flatMap(row => {
    const [path = '', number = '', ...rest] = row.split('\u0000')
    const text = rest.join('\u0000')
    const found = MARKER.exec(text)
    if (path.length === 0 || found === null) return []
    const tag = found[1] as Tag
    return [{ path, line: Number(number), tag, text: text.slice(found.index + tag.length) }]
  })

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

const headLine = (markers: readonly Marker[]): PaneLine => {
  const files = new Set(markers.map(marker => marker.path)).size
  const tally = TAGS.map(tag => [tag, markers.filter(marker => marker.tag === tag).length] as const)
    .filter(([, count]) => count > 0)
    .map(([tag, count]) => `${tag} ${count}`)
    .join('  ')
  return line('count', { text: `${plural(markers.length, 'marker')} in ${plural(files, 'file')}`, bold: true }, { text: `  ${tally}` })
}

const markerLine = (marker: Marker, width: number): PaneLine => {
  const cells: PaneCell[] = [
    { text: `  ${String(marker.line).padStart(width)}  `, dim: true },
    { text: marker.tag, color: COLORS[marker.tag], bold: true },
    { text: clean(marker.text) },
  ]
  return line(`todo-${marker.path}-${marker.line}`, ...cells)
}

// The first MAX_MARKERS markers, each file's under its path.
const markerLines = (markers: readonly Marker[]): PaneLine[] => {
  const shown = markers.slice(0, MAX_MARKERS)
  const width = Math.max(...shown.map(marker => String(marker.line).length))
  const paths = [...new Set(shown.map(marker => marker.path))]
  const rest = markers.length - shown.length
  return [
    headLine(markers),
    ...paths.flatMap(path => [
      line(`file-${path}`, { text: clean(path), bold: true, color: 'cyan' }),
      ...shown.filter(marker => marker.path === path).map(marker => markerLine(marker, width)),
    ]),
    ...(rest > 0 ? [line('more', { text: `… and ${rest} more`, dim: true })] : []),
  ]
}

const firstLine = (text: string): string => text.split('\n').find(each => each.trim().length > 0)?.trim() ?? ''

export const rule: PaneRule = {
  id: 'todo-pane',
  pane: {
    id: 'todo',
    title: 'TODOs',
    command: 'todo-pane',
    description: 'Show or hide the TODO pane: TODO, FIXME and HACK lines in tracked files, by file',
    empty: 'Searching tracked files…',
  },
  refreshAfter,
  load: async host => {
    const cwd = await host.cwd()
    let ran: ProcessRunResult
    try {
      ran = await host.run(['git', '--no-optional-locks', '-C', cwd, 'grep', '-z', '-n', '-I', '-w', '-E', '-e', MARKERS])
    } catch (error) {
      return [line('failed', { text: `git did not run: ${error instanceof Error ? error.message : String(error)}`, color: 'red' })]
    }
    const markers = parseMarkers(ran.stdout)
    if (markers.length > 0) return markerLines(markers)
    // git grep exits 1, with no output, when nothing matches.
    const reason = firstLine(ran.stderr)
    if (/not a git repository/i.test(reason)) return [line('no-repo', { text: `Not a git repository: ${cwd}`, dim: true })]
    if (ran.exitCode > 1 || reason.length > 0) return [line('failed', { text: `git grep failed: ${reason}`, color: 'red' })]
    return [line('none', { text: 'No TODO, FIXME or HACK in tracked files.', dim: true })]
  },
}
