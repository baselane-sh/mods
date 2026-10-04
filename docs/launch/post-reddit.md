# r/ClaudeAI post

Replace `<github-url>` before you post. Use the flair for tools or projects. Attach the demo video or a screenshot of `/wrapped` or `/receipt`.

## Title

We made 100+ small mods for Claude Code: guards, cost meters, sounds, yoda-mode and /wrapped. Pick the ones you want.

## Body

Claude Code 2.1.288 and later can run mods: plugins made of function hooks. We built a catalog of small ones. Each mod does one thing, and you can combine as many as you like.

**The fun ones**

- `yoda-mode`, `pirate-mode`, `caveman-mode`: Claude's prose changes. Code, commands and commit messages stay normal.
- `/wrapped`: a recap of your last 7 days with Claude Code, ready for a screenshot.
- `achievements`: eight badges, such as night owl and a 7-day streak.
- Sound packs: a coin when tests pass, a buzz when they fail (retro), or quieter office, sci-fi, nature and minimal packs.
- `sports-narrator`: one line of play-by-play at the end of a turn. Off by default, because it spends tokens.
- `latte-meter`: the session cost, in lattes.

**The useful ones**

- `guard-essentials`: asks before `rm -rf`, `terraform destroy`, `DROP TABLE`, a force-push, `curl | sh`, `sudo`, or a live key in a commit. It asks; you decide.
- `agent-firewall`: a live pane of every tool call the agent makes.
- `/receipt`: a receipt of the session (tools, files, commands, blocks, context, cost).
- `git-pane`, `test-pane`, `cost-meter`, `context-meter`.

**Install (from a clone)**

```sh
git clone <github-url> baselane-mods
claude plugin marketplace add "$PWD/baselane-mods"
claude plugin install guard-essentials@baselane-mods
claude plugin install yoda-mode@baselane-mods
```

**Privacy:** no mod sends data anywhere unless you set a destination, like an ntfy topic for phone pushes. No telemetry. MIT licence.

You need Claude Code 2.1.288 or later, with mods. Feedback is welcome, most of all on guards that ask too often.
