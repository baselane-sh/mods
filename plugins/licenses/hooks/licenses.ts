import type { CommandTools } from './engine'

export const UNKNOWN = 'unknown'

// One line, trimmed and short: a licence field can hold a whole licence text.
const tidy = (text: string): string => {
  const one = (text.split('\n')[0] ?? '').trim()
  return one === '' || one.length > 60 || /^unknown$/i.test(one) ? UNKNOWN : one
}

const text = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string') return value.type
  return undefined
}

// package.json: `license` as a string or { type }, or the old `licenses` array.
export const npmLicense = (manifest: string | undefined): string => {
  if (manifest === undefined) return UNKNOWN
  let data: unknown
  try {
    data = JSON.parse(manifest)
  } catch {
    return UNKNOWN
  }
  if (typeof data !== 'object' || data === null) return UNKNOWN
  const table = data as Record<string, unknown>
  const single = text(table.license)
  if (single !== undefined) return tidy(single)
  if (Array.isArray(table.licenses)) {
    const many = table.licenses.map(text).filter((t): t is string => t !== undefined)
    if (many.length > 0) return tidy(many.join(' OR '))
  }
  return UNKNOWN
}

// PEP 639 `License-Expression`, then `License`, then a `License ::` classifier.
// Only the header block is read: the body is the long description.
export const pythonLicense = (metadata: string | undefined): string => {
  if (metadata === undefined) return UNKNOWN
  const headers = (metadata.split(/\r?\n\r?\n/)[0] ?? '').split(/\r?\n/)
  const value = (name: string): string | undefined =>
    headers.find(row => row.toLowerCase().startsWith(`${name.toLowerCase()}:`))?.slice(name.length + 1)
  for (const field of ['License-Expression', 'License']) {
    const found = tidy(value(field) ?? '')
    if (found !== UNKNOWN) return found
  }
  const classifier = headers.find(row => /^Classifier:\s*License ::/.test(row))
  const last = classifier?.split('::').pop()?.trim()
  return last === undefined || last === '' ? UNKNOWN : tidy(last)
}

// PEP 503 name: runs of - _ . are one _, lower case.
const normal = (name: string): string => name.toLowerCase().replace(/[-_.]+/g, '_')

const ENVS = ['.venv', 'venv']

// Every site-packages folder of a virtualenv at the repo root.
const sitePackages = async (root: string, tools: CommandTools): Promise<string[]> => {
  const found: string[] = []
  for (const env of ENVS) {
    const libs = await tools.list(`${root}/${env}/lib`)
    for (const lib of libs ?? []) {
      if (lib.isDir && lib.name.startsWith('python')) found.push(`${root}/${env}/lib/${lib.name}/site-packages`)
    }
  }
  return found
}

// name (normalised) to the METADATA path of its dist-info folder.
export const pythonMetadata = async (root: string, tools: CommandTools): Promise<Map<string, string>> => {
  const found = new Map<string, string>()
  for (const folder of await sitePackages(root, tools)) {
    for (const entry of (await tools.list(folder)) ?? []) {
      if (entry.isDir && entry.name.endsWith('.dist-info')) {
        found.set(normal((entry.name.slice(0, -'.dist-info'.length).split('-')[0]) ?? ''), `${folder}/${entry.name}/METADATA`)
      }
    }
  }
  return found
}

export const pythonKey = normal
