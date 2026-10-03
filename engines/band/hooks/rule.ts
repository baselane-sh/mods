import type { PluginOptions } from 'claude-code'

import type { Reading } from '../types'

// One piece of the band. `key` names its Text so a test or a host can find it.
export type Segment = {
  key: string
  text: string
  color?: string
}

// What a rule may read to name its segment.
export type DrawContext = {
  reading: Reading
  options: PluginOptions
  // The local date, YYYY-MM-DD.
  date: string
}

// What a rule may touch at a turn end.
export type TurnEnd = {
  reading: Reading
  // What this turn cost, when known.
  turnUsd: number | undefined
  date: string
  // The mod's own store. The engine hands closures over `$.store`.
  store: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
  }
}

// One rule of the band: the segment it draws, and optionally what it keeps at
// a turn end (returned as the reading's new fields).
export type BandRule = {
  id: string
  segment: (draw: DrawContext) => Segment | undefined
  atTurnEnd?: (turn: TurnEnd) => Promise<Partial<Reading>>
}
