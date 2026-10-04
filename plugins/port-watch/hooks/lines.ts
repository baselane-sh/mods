import type { PaneCell, PaneLine } from '../types'
import { redact } from './patterns'

// Small builders the rules write their lines with, and the cuts the view
// makes. Pure: nothing here touches the host.

export const line = (key: string, ...cells: PaneCell[]): PaneLine => ({ key, cells })

export const ruleLine = (key: string): PaneLine => ({ key, cells: [], isRule: true })

// Every cell (and the key, which names a path) redacted whole, before any cut: a credential cut short no longer
// matches its shape and would slip through.
export const redactLines = (lines: readonly PaneLine[]): PaneLine[] =>
  lines.map(each => ({ ...each, key: redact(each.key), cells: each.cells.map(cell => ({ ...cell, text: redact(cell.text) })) }))

// Control characters (an ANSI color code, a tab) would draw as garbage or
// shift the columns.
export const clean = (text: string): string =>
  text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ')

const cut = (text: string, width: number): string => {
  if (width <= 0) return ''
  return text.length <= width ? text : `${text.slice(0, width - 1)}…`
}

// The cells that fit `columns`, left to right. The first that does not fit is
// cut with an ellipsis to the last column, so the ones after it are dropped.
export const fitCells = (cells: readonly PaneCell[], columns: number): PaneCell[] => {
  const fitted: PaneCell[] = []
  let used = 0
  for (const cell of cells) {
    const room = columns - used
    if (room <= 0) break
    const text = cut(cell.text, room)
    if (text.length > 0) fitted.push({ ...cell, text })
    used += text.length
  }
  return fitted
}

const two = (n: number): string => String(n).padStart(2, '0')

export const timeOfDay = (at: number): string => {
  const date = new Date(at)
  return `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
}

export const durationText = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const minutes = Math.floor(ms / 60_000)
  return `${minutes} min ${Math.round((ms % 60_000) / 1000)} s`
}
