# Launch page copy: baselane.sh/mods

Copy for the Baselane mods page. Every claim here is true of the catalog today. Do not add user counts, stars or quotes until they are real.

---

## Headline

Mods for Claude Code. Pick them. Combine them.

## Subhead

100+ small, free, open-source mods for Claude Code: guards that ask before `rm -rf`, live panes, cost meters, sounds, stats and new voices for Claude. Each mod does one thing. Install the ones you want.

**Primary button:** Install from GitHub (`<github-url>`)
**Second button:** See the catalog

---

## Feature blocks

### Guards that ask first

`guard-essentials` asks before harsh commands: `terraform destroy`, `DROP TABLE`, a force-push, `curl | sh`, `sudo`, or a live API key in a commit. Guards never block on their own. They stop, show you why, and let you decide. Want to see every call? `agent-firewall` opens a live pane of each tool call, green when it ran and red when it was blocked.

### See what the session costs

`cost-meter` puts the session cost above the prompt. `latte-meter` counts it in lattes. `/receipt` prints a receipt of the session (tools, files, commands, blocks, context, cost) and copies it, ready to share.

### Give Claude a voice

`pirate-mode`, `yoda-mode`, `caveman-mode` and `shakespeare-mode` change how Claude writes its prose. Code, commands and commit messages stay exact. For work, there is `terse-mode`, `no-sycophancy` and `plain-english`.

### Make it fun

`sounds-retro` plays a coin when tests pass and a buzz when they fail, and other sound packs are quieter. `achievements` unlocks eight badges. `/wrapped` prints your last 7 days with Claude Code, ready for a screenshot. `sports-narrator` calls each turn like a game (off by default, because it spends tokens).

### Yours, on your machine

MIT licence. No account. No mod sends your data anywhere unless you set a destination yourself, such as an ntfy topic for phone pushes. Display mods change only your screen, never what Claude reads.

---

## Demo script (30-second video)

Record in one terminal, at a large font size. Install these mods before you start: `guard-essentials`, `cost-meter`, `latte-meter`, `pirate-mode`, `sounds-retro`, `receipt`, `agent-firewall`.

| Time | On screen | Caption |
| --- | --- | --- |
| 0 to 3 s | Claude Code starts. The cost band and the latte band show above the prompt. | Mods for Claude Code. |
| 3 to 9 s | Ask Claude to explain a function. It answers in pirate prose. The code block in the answer stays normal. | Change how Claude talks. Code stays exact. |
| 9 to 15 s | Ask Claude to run the tests. The retro coin plays when they pass. | Sounds for passing and failing tests. |
| 15 to 22 s | Ask Claude to clean up with `rm -rf build`. The guard stops and asks. Choose no. Open `/firewall` and show the refused call in the list. | Guards ask before harsh commands. |
| 22 to 28 s | Run `/receipt`. The receipt prints. | A receipt for every session. |
| 28 to 30 s | Logo and the install line. | 100+ mods. Pick and combine. baselane.sh/mods |

Notes for the recording:

- Use a scratch repository. Do not show real keys, paths or costs that you do not want to share.
- Show the real prompt and the real answer. Do not edit the output.

---

## FAQ

**What is a mod?**
A Claude Code plugin made of function hooks. A mod can ask before a tool call, draw a band or a pane, add a slash command, play a sound or add a short instruction for Claude.

**What do I need?**
Claude Code 2.1.288 or later, with mods. Some mods use git or `lsof`.

**Is it free?**
Yes. The mods are open source under the MIT licence.

**Can I combine mods?**
Yes. That is the idea. Mods from different families work together. Install a pack or its single mods, not both, or a rule runs two times.

**Do mods send my data anywhere?**
Not unless you set a destination. `ntfy-notify` and `long-run-notify` send a short phone push through ntfy.sh, and only when you set a topic. `sports-narrator` makes one small model call per turn when you turn it on, with tool names and file names only.

**Do guards slow me down?**
`guard-essentials` asks only before harsh or disaster commands. Daily commands pass with no question. For more guards, install `guard-pack` or single guards.

**Can a guard stop a real attack?**
A guard is a second check, not a sandbox. It looks for known harsh patterns and asks you. Keep your normal permissions and backups.

**Do the voice mods change my code?**
No. Voice mods change only Claude's prose. Code, commands and commit messages stay exact.

**How do I remove a mod?**
`claude plugin uninstall <mod>@baselane-mods`.

**Can I write my own mod?**
Yes. Add a rule to an engine and a line in the catalog. The README tells you how.
