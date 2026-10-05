import type { BandRule } from '../rule'

const MAX_CHARS = 40

// One fixed script per player: nothing from the session or the repository is
// ever put into it. `is running` first, so asking never launches the player.
const scriptOf = (player: 'Music' | 'Spotify'): readonly string[] => [
  `if application "${player}" is running then`,
  `tell application "${player}"`,
  'if player state is playing then',
  'return (name of current track) & " - " & (artist of current track)',
  'end if',
  'end tell',
  'end if',
  'return ""',
]

const argvOf = (player: 'Music' | 'Spotify'): readonly string[] => ['osascript', ...scriptOf(player).flatMap(line => ['-e', line])]

export const trackText = (stdout: string): string | undefined => {
  const line = stdout.split('\n')[0]?.trim() ?? ''
  if (line === '') return undefined
  return line.length > MAX_CHARS ? `${line.slice(0, MAX_CHARS - 1)}…` : line
}

// The track Music or Spotify plays, read through osascript at most once a
// minute. Music is asked first and Spotify only when Music plays nothing; each
// has its own call, so a Mac with no Spotify still answers for Music.
export const rule: BandRule = {
  id: 'now-playing',
  fetch: {
    everyMs: 60_000,
    timeoutMs: 5000,
    read: async run => {
      for (const player of ['Music', 'Spotify'] as const) {
        const ran = await run(argvOf(player)).catch(() => undefined)
        const track = ran?.exitCode === 0 ? trackText(ran.stdout) : undefined
        if (track !== undefined) return { text: `♪ ${track}` }
      }
      return null
    },
  },
  segment: ({ fetched }) => {
    const found = fetched['now-playing']
    return found === null || found === undefined ? undefined : { key: 'now-playing', ...found }
  },
}
