import type { CommandRule, CommandTools, Composed } from '../engine'
import { bullets, count, finish, isRepo, message, notARepo, repoRoot } from '../helpers'
import { headings, relativeLinks, resolveLink, SECTIONS } from '../readme'

const MAX_LINKS = 30
const NAME = /^readme(\.(md|markdown|rst|txt))?$/i

// README.md first, then any other README spelling.
const findReadme = async (root: string, tools: CommandTools): Promise<string | undefined> => {
  const entries = (await tools.list(root)) ?? []
  const names = entries.filter(e => !e.isDir && NAME.test(e.name)).map(e => e.name)
  return names.find(n => /\.md$/i.test(n)) ?? names[0]
}

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const root = (await repoRoot(tools)) ?? (await tools.cwd())
  const file = await findReadme(root, tools)
  if (file === undefined) return message('No README at the repo root.')
  const text = await tools.read(`${root}/${file}`)
  if (text === undefined) return message(`Could not read ${file}.`)

  const titles = headings(text)
  const missing = SECTIONS.filter(([, pattern]) => !titles.some(title => pattern.test(title))).map(([label]) => label)

  const broken: string[] = []
  for (const { line, target } of relativeLinks(text)) {
    const path = resolveLink('', target)
    if (path !== undefined && path !== '' && !(await tools.exists(`${root}/${path}`))) broken.push(`${file}:${line}  ${target}`)
  }

  return finish(
    [
      `README check: ${file}`,
      '',
      missing.length === 0 ? 'Sections: install, usage, licence and contributing are all there.' : `Missing sections (${missing.length}): ${missing.join(', ')}`,
      broken.length === 0 ? 'Relative links: none broken.' : `Broken relative links (${count(broken.length, 'link')}):`,
      ...bullets(broken, MAX_LINKS),
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'readme-check',
  description: 'Report which README sections are missing (install, usage, licence, contributing) and which relative links are broken',
  compose,
}
