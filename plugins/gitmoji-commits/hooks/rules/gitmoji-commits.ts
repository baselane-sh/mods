import type { StyleRule } from '../engine'

export const rule: StyleRule = {
  id: 'gitmoji-commits',
  section:
    'Style: gitmoji commits. Start every commit message (and squash or merge message) with the gitmoji that matches the change, then a space, then the rest: ✨ feat, 🐛 fix, 📝 docs, 💄 style, ♻️ refactor, ⚡️ perf, ✅ test, 📦️ build, 👷 ci, 🔧 chore, ⏪️ revert, 💥 breaking change. Pick one emoji per commit. If Conventional Commits is also on, this does not replace it: keep its whole first line and put the emoji first, then a space, then the type (for example "✨ feat(api): add retry"). Under 72 characters still counts the emoji. This applies only to commit messages.',
}
