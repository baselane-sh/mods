import type { PluginOptions } from 'claude-code'

// Runs a program and gives back what it printed (a closure over `$.process.run`).
export type Run = (argv: readonly string[]) => Promise<{ exitCode: number; stdout: string }>

// One style rule: an id and the text it adds to the system prompt. A rule
// that depends on a userConfig value gives a function of the options. A rule
// whose text comes from a program gives `live` instead: a host (hosts/live.ts)
// calls it once per session and adds what it returns, and the rule's
// `section` is then unused. `live` answers undefined to add nothing.
export type StyleRule = {
  id: string
  section: string | ((options: PluginOptions) => string)
  live?: (run: Run) => Promise<string | undefined>
}

// The section id for a rule. A plugin's own id is `<plugin>:<name>`, so two
// style mods installed together never collide.
export const sectionId = (rule: StyleRule): string => `${rule.id}:style`

export const textOf = (rule: StyleRule, options: PluginOptions): string =>
  typeof rule.section === 'function' ? rule.section(options) : rule.section
