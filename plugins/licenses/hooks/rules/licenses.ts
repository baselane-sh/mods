import type { CommandRule, CommandTools, Composed } from '../engine'
import { cap, finish, isRepo, message, notARepo, repoRoot } from '../helpers'
import { npmLicense, pythonKey, pythonLicense, pythonMetadata, UNKNOWN } from '../licenses'
import { npmDeps, pyprojectDeps, requirementsDeps, type Dep } from '../manifests'

const MAX_ROWS = 100

const names = (deps: readonly Dep[] | undefined): string[] => [...new Set((deps ?? []).map(d => d.name))].sort()

const npmRows = async (root: string, tools: CommandTools, deps: readonly string[]): Promise<string[]> => {
  const rows: string[] = []
  for (const name of deps) rows.push(`  ${name}  ${npmLicense(await tools.read(`${root}/node_modules/${name}/package.json`))}`)
  return rows
}

const pythonRows = async (root: string, tools: CommandTools, deps: readonly string[]): Promise<string[]> => {
  const metadata = await pythonMetadata(root, tools)
  const rows: string[] = []
  for (const name of deps) {
    const path = metadata.get(pythonKey(name))
    rows.push(`  ${name}  ${path === undefined ? UNKNOWN : pythonLicense(await tools.read(path))}`)
  }
  return rows
}

const compose = async (_record: unknown, _facts: unknown, tools: CommandTools): Promise<Composed> => {
  if (!(await isRepo(tools))) return notARepo(await tools.cwd())
  const root = (await repoRoot(tools)) ?? (await tools.cwd())

  const pkg = await tools.read(`${root}/package.json`)
  const npm = pkg === undefined ? [] : names(npmDeps(pkg))
  const py = [
    ...names(pyprojectDepsOf(await tools.read(`${root}/pyproject.toml`))),
    ...names(requirementsOf(await tools.read(`${root}/requirements.txt`))),
  ]
  const python = [...new Set(py)].sort()
  if (npm.length === 0 && python.length === 0) return message('No direct dependencies found in package.json, pyproject.toml or requirements.txt.')

  const groups: string[][] = []
  if (npm.length > 0) {
    const missing = !(await tools.exists(`${root}/node_modules`))
    groups.push([`npm (${npm.length})`, ...(missing ? ['  node_modules not found, so every licence is unknown'] : []), ...(await npmRows(root, tools, npm))])
  }
  if (python.length > 0) groups.push([`python (${python.length})`, ...(await pythonRows(root, tools, python))])
  const rows = groups.flatMap(group => ['', ...group])
  return finish(['Licences of direct dependencies', ...cap(rows, MAX_ROWS + groups.length)].join('\n'))
}

const pyprojectDepsOf = (text: string | undefined): Dep[] => (text === undefined ? [] : pyprojectDeps(text))
const requirementsOf = (text: string | undefined): Dep[] => (text === undefined ? [] : requirementsDeps(text))

export const rule: CommandRule = {
  name: 'licenses',
  description: 'List the licence of each direct dependency from node_modules and Python dist-info, "unknown" when missing (read-only)',
  compose,
}
