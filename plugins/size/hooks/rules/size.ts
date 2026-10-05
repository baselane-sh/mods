import type { CommandRule, CommandTools, Composed } from '../engine'
import { count, finish, isRepo, message, notARepo } from '../helpers'

const TOP = 15

type Blob = { path: string; bytes: number }

// "100644 blob <sha>     123\tpath". A submodule row has a "-" size and is dropped.
const ROW = /^\d+ blob \S+\s+(\d+)\t([\s\S]+)$/

const parse = (row: string): Blob | undefined => {
  const hit = ROW.exec(row)
  return hit === null ? undefined : { path: hit[2] ?? '', bytes: Number(hit[1]) }
}

const UNITS = ['B', 'KB', 'MB', 'GB']

const human = (bytes: number): string => {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return unit === 0 ? `${bytes} B` : `${value.toFixed(1)} ${UNITS[unit]}`
}

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  // Sizes come from the committed tree: the index has no size. -z keeps odd paths whole.
  const ran = await tools.gitRun('ls-tree', '-r', '-l', '-z', 'HEAD')
  if (ran.timedOut) throw new Error('git ls-tree timed out')
  if (ran.truncated) throw new Error('git ls-tree output passed the 4 MiB cap')
  const blobs = ran.stdout
    .split('\0')
    .map(parse)
    .filter((blob): blob is Blob => blob !== undefined)
  if (ran.code !== 0 || blobs.length === 0) return message('No committed files yet.')

  const total = blobs.reduce((sum, blob) => sum + blob.bytes, 0)
  const largest = [...blobs].sort((a, b) => b.bytes - a.bytes || (a.path < b.path ? -1 : 1)).slice(0, TOP)
  return finish(
    [
      `Tracked size at HEAD: ${human(total)} in ${count(blobs.length, 'file')}`,
      '',
      `Largest ${Math.min(TOP, blobs.length)}:`,
      ...largest.map(blob => `${human(blob.bytes)}  ${blob.path}`),
    ].join('\n'),
  )
}

export const rule: CommandRule = {
  name: 'size',
  description: 'List the 15 largest tracked files and the total tracked size at HEAD (read-only)',
  compose,
}
