import type { CommandRule, CommandTools, Composed } from '../engine'
import { bullets, finish, isRepo, message, notARepo, repoRoot } from '../helpers'

const TEMPLATES = ['.env.example', '.env.sample', '.env.template']
const LIMIT = 50

// A name is what comes before the first "=" on a line. The match captures the
// name and nothing after it, so a value is never held past this function.
const NAME = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=/

const namesIn = (text: string | undefined): string[] => {
  const found = (text ?? '').split('\n').map(row => NAME.exec(row)?.[1])
  return [...new Set(found.filter((name): name is string => name !== undefined))].sort()
}

const plural = (n: number): string => `${n} ${n === 1 ? 'name' : 'names'}`

const section = (title: string, names: readonly string[]): string[] =>
  names.length === 0 ? [] : ['', `${title} (${names.length})`, ...bullets(names, LIMIT)]

// The first template that exists, as { file, text }.
const template = async (root: string, tools: CommandTools): Promise<{ file: string; text: string } | undefined> => {
  for (const file of TEMPLATES) {
    const text = await tools.read(`${root}/${file}`)
    if (text !== undefined) return { file, text }
  }
  return undefined
}

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const root = (await repoRoot(tools)) ?? (await tools.cwd())
  const wanted = await template(root, tools)
  if (wanted === undefined) return message('No .env.example, .env.sample or .env.template at the repo root.')

  const actual = await tools.read(`${root}/.env`)
  const expected = namesIn(wanted.text)
  const present = namesIn(actual)
  const missing = expected.filter(name => !present.includes(name))
  const extra = present.filter(name => !expected.includes(name))
  const left = actual === undefined ? '.env (not found)' : `.env (${plural(present.length)})`
  return finish(
    [
      `Env check: ${wanted.file} (${plural(expected.length)}) against ${left}`,
      ...(missing.length === 0 && extra.length === 0 ? ['', 'All names are present, none extra.'] : []),
      ...section('Missing from .env', missing),
      ...section('Extra in .env', extra),
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'env-check',
  description: 'Compare variable names in .env.example with .env, listing missing and extra names (never values), and copy it',
  compose,
}
