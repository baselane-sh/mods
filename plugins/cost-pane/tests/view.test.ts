import { expect, test } from 'claude-code/testing'

import { fitCells, timeOfDay } from '../hooks/lines'

const CELLS = [{ text: 'abcdef', bold: true }, { text: '  ' }, { text: 'ghijkl', color: 'red' }]
const width = (cells: readonly { text: string }[]) => cells.map(cell => cell.text).join('').length

test('pane view: cells that fit are kept whole', () => {
  expect(fitCells(CELLS, 80)).toEqual(CELLS)
  expect(fitCells(CELLS, 14)).toEqual(CELLS)
})

test('pane view: the first cell that does not fit is cut with an ellipsis and the rest dropped', () => {
  expect(fitCells(CELLS, 11)).toEqual([{ text: 'abcdef', bold: true }, { text: '  ' }, { text: 'gh…', color: 'red' }])
  expect(fitCells(CELLS, 4)).toEqual([{ text: 'abc…', bold: true }])
  expect(fitCells(CELLS, 6)).toEqual([{ text: 'abcdef', bold: true }])
})

test('pane view: no line is wider than the pane, down to nothing', () => {
  for (let columns = 0; columns <= 16; columns += 1) {
    expect({ columns, fits: width(fitCells(CELLS, columns)) <= columns }).toEqual({ columns, fits: true })
  }
  expect(fitCells(CELLS, 0)).toEqual([])
})

test('pane view: the time of day has two digits a field', () => {
  expect(timeOfDay(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe('03:04:05')
})
