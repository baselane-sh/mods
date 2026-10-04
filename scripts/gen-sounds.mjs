// Synthesizes the sound packs under engines/sound/assets/<pack>/ as small
// mono 16-bit WAV files. Pure Node, no packages, and deterministic (noise
// comes from a seeded generator), so a rerun leaves the files unchanged.
//
//   node scripts/gen-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const RATE = 16000
const MAX_SECONDS = 0.45

const sine = phase => Math.sin(2 * Math.PI * phase)
const square = phase => (phase % 1 < 0.5 ? 1 : -1)

// A seeded noise source: the same samples on every run.
const noiseSource = seed => {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 31 - 1
  }
}

// One note: `freq` may be a number or a function of time (a sweep). `decay`
// is the envelope's time constant in seconds; a 3 ms attack avoids clicks.
const tone = ({ wave = sine, freq, secs, decay, gain = 0.6 }) => {
  const count = Math.floor(secs * RATE)
  let phase = 0
  return Array.from({ length: count }, (_, i) => {
    const t = i / RATE
    phase += (typeof freq === 'function' ? freq(t) : freq) / RATE
    const attack = Math.min(1, t / 0.003)
    return wave(phase) * attack * Math.exp(-t / decay) * gain
  })
}

const noise = ({ seed, secs, decay, gain = 0.5, smooth = 0 }) => {
  const next = noiseSource(seed)
  let last = 0
  return Array.from({ length: Math.floor(secs * RATE) }, (_, i) => {
    const t = i / RATE
    last = smooth * last + (1 - smooth) * next()
    return last * Math.min(1, t / 0.002) * Math.exp(-t / decay) * gain
  })
}

const silence = secs => new Array(Math.floor(secs * RATE)).fill(0)
const join2 = (...parts) => parts.flat()

const mix = (...layers) => {
  const length = Math.max(...layers.map(layer => layer.length))
  return Array.from({ length }, (_, i) => layers.reduce((sum, layer) => sum + (layer[i] ?? 0), 0))
}

// Linear fade over the last 10 ms so no file ends on a step.
const finish = samples =>
  samples.map((s, i) => {
    const left = (samples.length - i) / RATE
    return Math.max(-1, Math.min(1, left < 0.01 ? s * (left / 0.01) : s))
  })

const wav = samples => {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((s, i) => data.writeInt16LE(Math.round(s * 32767), i * 2))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16) // fmt chunk size
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28) // byte rate
  header.writeUInt16LE(2, 32) // block align
  header.writeUInt16LE(16, 34) // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

// Four sounds per pack: pass (tests passed), fail (tests failed), deny (a
// call was blocked), done (the turn finished).
const PACKS = {
  retro: {
    pass: () => join2(tone({ wave: square, freq: 988, secs: 0.07, decay: 1, gain: 0.35 }), tone({ wave: square, freq: 1319, secs: 0.3, decay: 0.12, gain: 0.35 })),
    fail: () => mix(tone({ wave: square, freq: 110, secs: 0.42, decay: 0.4, gain: 0.35 }), noise({ seed: 7, secs: 0.42, decay: 0.3, gain: 0.12 })),
    deny: () => tone({ wave: square, freq: t => 440 - 900 * t, secs: 0.2, decay: 0.25, gain: 0.35 }),
    done: () => join2(tone({ freq: 784, secs: 0.12, decay: 0.08 }), tone({ freq: 1047, secs: 0.3, decay: 0.1 })),
  },
  office: {
    pass: () => mix(tone({ freq: 2600, secs: 0.03, decay: 0.006, gain: 0.5 }), noise({ seed: 3, secs: 0.03, decay: 0.006, gain: 0.3 })),
    fail: () => mix(tone({ freq: t => 90 - 80 * t, secs: 0.3, decay: 0.07, gain: 0.9 }), noise({ seed: 5, secs: 0.05, decay: 0.01, gain: 0.2, smooth: 0.9 })),
    deny: () => noise({ seed: 11, secs: 0.35, decay: 0.12, gain: 0.7, smooth: 0.55 }),
    done: () => mix(tone({ freq: 880, secs: 0.45, decay: 0.12, gain: 0.35 }), tone({ freq: 1760, secs: 0.45, decay: 0.06, gain: 0.12 })),
  },
  scifi: {
    pass: () => join2(tone({ freq: 1200, secs: 0.08, decay: 1, gain: 0.35 }), silence(0.03), tone({ freq: 1600, secs: 0.12, decay: 0.2, gain: 0.35 })),
    fail: () => {
      const pulse = tone({ wave: square, freq: t => (t % 0.2 < 0.1 ? 600 : 800), secs: 0.4, decay: 1, gain: 0.25 })
      return pulse
    },
    deny: () => tone({ wave: square, freq: t => 300 - 500 * t, secs: 0.22, decay: 0.3, gain: 0.3 }),
    done: () => tone({ freq: t => 200 + 1800 * t * t * 4.5, secs: 0.45, decay: 0.3, gain: 0.45 }),
  },
}

let total = 0
for (const [pack, sounds] of Object.entries(PACKS)) {
  const dir = join(ROOT, 'engines/sound/assets', pack)
  mkdirSync(dir, { recursive: true })
  let bytes = 0
  for (const [name, make] of Object.entries(sounds)) {
    const samples = finish(make())
    if (samples.length / RATE >= MAX_SECONDS + 0.001) throw new Error(`${pack}/${name} is longer than ${MAX_SECONDS}s`)
    const file = wav(samples)
    writeFileSync(join(dir, `${name}.wav`), file)
    bytes += file.length
  }
  total += bytes
  process.stdout.write(`${pack}: ${Object.keys(sounds).length} files, ${bytes} bytes\n`)
}
process.stdout.write(`total ${total} bytes\n`)
