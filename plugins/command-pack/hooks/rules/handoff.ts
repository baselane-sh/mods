import type { CommandRecord } from '../../types'
import type { CommandRule, CommandTools } from '../engine'
import { bullets, count, finish, isRepo, lines } from '../helpers'

const MAX_STATUS_LINES = 50
const DIR = '.claude'

// `.claude/handoff.md`, or the first free `.claude/handoff-<n>.md`. Never a
// path that exists.
const freePath = async (tools: CommandTools, cwd: string): Promise<string> => {
  const first = `${cwd}/${DIR}/handoff.md`
  if (!(await tools.exists(first))) return first
  for (let n = 1; ; n += 1) {
    const path = `${cwd}/${DIR}/handoff-${n}.md`
    if (!(await tools.exists(path))) return path
  }
}

const gitSection = async (tools: CommandTools): Promise<string[]> => {
  if (!(await isRepo(tools))) return ['Git: not a git repository, so there is no git status.']
  const status = lines(await tools.git('status', '--short'))
  if (status.length === 0) return ['Git status (short): clean']
  const more = status.length - MAX_STATUS_LINES
  return ['Git status (short):', '```text', ...status.slice(0, MAX_STATUS_LINES), ...(more > 0 ? [`... and ${more} more`] : []), '```']
}

const changed = (record: CommandRecord): string[] =>
  record.files.length === 0 ? ['No files were written or edited in this session.'] : bullets(record.files, record.files.length)

const commands = (record: CommandRecord): string[] => {
  if (record.commands.length === 0) return ['None.']
  const earlier = record.commandsRun - record.commands.length
  return [...(earlier > 0 ? [`(${earlier} earlier commands not kept)`] : []), ...record.commands.map(c => `- ${c}`)]
}

const blocked = (record: CommandRecord): string[] => {
  const rows = [
    ...(record.blocked === 0 ? [] : [`- ${count(record.blocked, 'tool call')} blocked by a hook`]),
    ...(record.errored === 0 ? [] : [`- ${count(record.errored, 'tool call')} ended in an error`]),
  ]
  return rows.length === 0 ? ['None.'] : rows
}

const compose = async (record: CommandRecord, _facts: unknown, tools: CommandTools): Promise<string> => {
  const cwd = await tools.cwd()
  const inRepo = await isRepo(tools)
  const body = finish(
    [
      '# Session handoff',
      '',
      '## What changed',
      ...changed(record),
      '',
      ...(await gitSection(tools)),
      '',
      '## Commands run',
      ...commands(record),
      '',
      '## Blocked calls',
      ...blocked(record),
      '',
      '## Open questions',
      '- (add the questions for the next session here)',
      '',
    ].join('\n'),
  )

  const path = await freePath(tools, cwd)
  await tools.write(path, body)

  const first = `${cwd}/${DIR}/handoff.md`
  return finish(
    [
      `Handoff written: ${path}`,
      ...(path === first ? [] : [`${first} already exists and was left as it was.`]),
      ...(inRepo ? [] : [`Not a git repository: ${cwd}, so the handoff has no git status.`]),
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'handoff',
  description: 'Write a session summary to .claude/handoff.md (never overwriting) and answer with the path',
  compose,
}
