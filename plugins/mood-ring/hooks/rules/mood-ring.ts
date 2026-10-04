import type { Outcome } from '../../types'
import type { BandRule } from '../rule'

const TENSE_FROM = 0.1
const STORMY_FROM = 0.3

type Mood = { word: string; color: string }

// The share of the window that errored or was blocked. Under 10 percent is
// calm, under 30 tense, from 30 stormy.
export const moodOf = (recent: readonly Outcome[]): Mood => {
  const bad = recent.filter(outcome => outcome !== 'ok').length
  const rate = bad / recent.length
  if (rate >= STORMY_FROM) return { word: 'stormy', color: 'red' }
  if (rate >= TENSE_FROM) return { word: 'tense', color: 'yellow' }
  return { word: 'calm', color: 'green' }
}

// A colored dot and a word for how the last 20 tool calls went (the engine
// keeps that window). The word says the same without the color. Calls from
// subagents count too: they are part of how the session is going.
export const rule: BandRule = {
  id: 'mood-ring',
  tracksOutcomes: true,
  segment: ({ outcomes }) => {
    if (outcomes.length === 0) return undefined
    const { word, color } = moodOf(outcomes)
    return { key: 'mood-ring', text: `● ${word}`, color }
  },
}
