import { pairs, sections } from './toml'

// One runnable task: its name and, when the file gives one, what it runs.
export type Task = { name: string; detail?: string }

const task = (name: string, detail?: string): Task => ({ name, ...(detail === undefined ? {} : { detail }) })

const unique = (tasks: readonly Task[]): Task[] => tasks.filter((t, i) => tasks.findIndex(o => o.name === t.name) === i)

// Undefined when the text is not JSON (the message is not echoed: a parse error repeats the input).
export const npmScripts = (text: string): Task[] | undefined => {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return undefined
  }
  const found = typeof data === 'object' && data !== null ? (data as Record<string, unknown>).scripts : undefined
  if (typeof found !== 'object' || found === null) return []
  return Object.entries(found).map(([name, run]) => task(name, typeof run === 'string' ? run : undefined))
}

// A target is a name at the start of a row followed by ":" but not ":=".
// Pattern rules (%), special targets (.PHONY) and variables are not tasks.
const TARGET = /^([A-Za-z0-9_][A-Za-z0-9_./-]*)\s*:(?![=:])/

export const makeTargets = (text: string): Task[] =>
  unique(text.split('\n').flatMap(row => {
    const name = TARGET.exec(row)?.[1]
    return name === undefined || name.includes('%') ? [] : [task(name)]
  }))

// A recipe is a name (optionally "@name", then parameters) before a ":" that
// does not start ":=". Settings, variables and aliases all use ":=" or none.
const RECIPE = /^@?([A-Za-z_][A-Za-z0-9_-]*)\b[^:]*:(?!=)/

export const justRecipes = (text: string): Task[] =>
  unique(text.split('\n').flatMap(row => {
    const name = RECIPE.exec(row)?.[1]
    return name === undefined ? [] : [task(name)]
  }))

const value = (raw: string): string => raw.replace(/^["']|["']$/g, '')

export const pyScripts = (text: string): Task[] => {
  const all = sections(text)
  return ['project.scripts', 'tool.poetry.scripts'].flatMap(name =>
    pairs(all.get(name) ?? []).map(([key, entry]) => task(key, value(entry))),
  )
}
