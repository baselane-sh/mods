import type { PromptComposeInput, PromptComposeSection } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

// The sections the engine itself composes, and a section another style mod
// already added (a plugin's own id is `<plugin>:<name>`).
export const ENGINE_SECTIONS: readonly PromptComposeSection[] = [
  { id: 'intro', text: 'You are Claude Code.', scope: 'shared' },
  { id: 'tone', text: 'Be helpful.', scope: 'shared' },
  { id: 'memory', text: 'Remember things.', scope: 'session' },
]

export const OTHER_STYLE: PromptComposeSection = { id: 'other-style:style', text: 'Style: other.', scope: 'session' }

// The facts a prompt is composed for; the plugin does not read them.
const FACTS: PromptComposeInput = {
  model: 'claude-test',
  promptModel: 'claude-test',
  surfaces: ['terminal'],
  tools: [],
  outputStyle: null,
  traits: [],
}

// Stands in for the engine beneath the style rules: it composes `existing`,
// and the plugin answers on top of that list.
export const compose = async ($: Engine, on: OnFn, existing: readonly PromptComposeSection[] = ENGINE_SECTIONS) => {
  on('prompt.compose', () => ({ sections: existing }))
  return (await $.prompt.compose(FACTS)).sections
}
