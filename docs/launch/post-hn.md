# Show HN

Post the title with the GitHub URL as the link, then post the first comment at once.

## Title

Show HN: Baselane mods, 100+ small Claude Code plugins you pick and combine

## First comment

Hi HN. Claude Code 2.1.288 and later can run mods: plugins made of function hooks that can ask before a tool call, draw a band or a side pane, add a slash command or play a sound. We wrote a catalog of small mods on top of that API.

Each mod does one thing, so you install only what you want. Some examples:

- Guards. `guard-essentials` asks before `terraform destroy`, `DROP TABLE`, a force-push, `curl | sh`, `sudo`, or a commit with a live key. Guards ask. They never block on their own, and if a check fails, they ask rather than let the call through.
- `agent-firewall`: a live pane of every tool call, with counters for ran, asked and blocked.
- `cost-meter` and `latte-meter`: the session cost above the prompt, in dollars or in lattes. `/receipt` prints a receipt of the session.
- `git-pane`, `test-pane`, `port-watch`: live side panes.
- Voices: `pirate-mode`, `yoda-mode`, `caveman-mode`. They change the prose only. Code and commands stay exact.
- Fun: sound packs, `achievements`, `/wrapped`, and `sports-narrator`, which calls each turn like a match.

How it is built: each family (guards, panes, band meters and so on) has one engine. A rule is one file in that engine, and a catalog entry names the rules a mod uses. A build script copies the engine and the rules into one standalone plugin per mod. A mod with several rules is a pack, for example `guard-pack`. Every rule has its own tests, and a check script runs `claude plugin validate`, `claude plugin test` and a type check on each mod.

Some things we chose on purpose:

- Nothing leaves your machine unless you set a destination, such as an ntfy topic for phone pushes. There is no telemetry.
- Today `sports-narrator` is the only mod that makes a model call. It is off by default, because it spends tokens, and it sends tool names and file names only.
- Guards look for known patterns. They are a second check, not a sandbox.

Limits: the mods need Claude Code 2.1.288 or later, with mods (the API is early access). Because each mod is standalone, a pack and one of its single mods installed together run the same rule two times.

It is MIT. We would like to hear which mods you find useful, and which guard patterns are too loud or too quiet.
