import type { BandRule } from '../rule'

// `claude-opus-4-1-20250805[1m]` reads `opus-4-1`. A name that is not an id
// (such as "Opus 4.1") is kept as it is.
export const shortModel = (model: string): string =>
  model
    .replace(/\[.*\]$/, '')
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')

// The model the session runs on (what `$.session.model()` answers, read at each
// turn end, so a /model switch shows from the next one) and the context percent.
export const rule: BandRule = {
  id: 'model-badge',
  segment: ({ reading }) => {
    const parts = [
      ...(reading.model === undefined ? [] : [shortModel(reading.model)]),
      ...(reading.percent === undefined ? [] : [`${Math.round(reading.percent)}%`]),
    ]
    return parts.length === 0 ? undefined : { key: 'model-badge', text: parts.join(' · ') }
  },
}
