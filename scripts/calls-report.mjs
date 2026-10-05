// Runs `claude plugin validate` on every built mod and prints, one line per
// mod, the hooks it registers and the `$` calls it can make. The gallery
// shows these calls as the mod's abilities, so compare them with the mod's
// catalog description. Run `node scripts/build.mjs` first.
//
//   node scripts/calls-report.mjs [mod ...] > calls.txt
//
// Line format: <mod> | hooks: a, b | calls: c, d
import { execFile } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const ROOT = new URL('..', import.meta.url).pathname
const PLUGINS = join(ROOT, 'plugins')
const PARALLEL = 8
const run = promisify(execFile)

// Splits `a, b{x=1, y=2}, c` on the commas outside braces.
const splitTop = text => {
  const items = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') depth -= 1
    else if (text[i] === ',' && depth === 0) {
      items.push(text.slice(start, i).trim())
      start = i + 1
    }
  }
  return [...items, text.slice(start).trim()]
}

// Each module line reads `❯ ./register.ts calls: $.a.b, $.c.d`. A mod has one
// module, but merge every module line so a mod with more still reports all.
const field = (output, name) => {
  const pattern = new RegExp(`❯ \\./\\S+ ${name}: (.*)$`)
  const values = output
    .split('\n')
    .map(line => line.match(pattern)?.[1])
    .filter(found => found !== undefined)
    .flatMap(splitTop)
    .filter(item => item !== '' && item !== 'nothing')
  return [...new Set(values)].sort()
}

const report = async name => {
  try {
    const { stdout, stderr } = await run('claude', ['plugin', 'validate', join(PLUGINS, name)])
    const output = `${stdout}\n${stderr}`
    return `${name} | hooks: ${field(output, 'hooks').join(', ')} | calls: ${field(output, 'calls').join(', ')}`
  } catch (error) {
    process.exitCode = 1
    return `${name} | validate failed: ${String(error.stderr || error.message).split('\n')[0]}`
  }
}

const names = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(PLUGINS).sort()
const lines = new Array(names.length)
let next = 0
const worker = async () => {
  while (next < names.length) {
    const index = next
    next += 1
    lines[index] = await report(names[index])
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker))
process.stdout.write(`${lines.join('\n')}\n`)
