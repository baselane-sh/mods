# Baselane mods

Small mods for Claude Code. Pick the ones you want and combine them.

Baselane mods are Claude Code plugins made of function hooks. Each mod does one thing: a guard that asks before `rm -rf`, a band with the session cost, a side pane with your git status, a sound when tests pass, a pirate voice for Claude's prose. There are 100+ mods in families such as guards, panes, meters, sounds and stats. Install one, or stack ten. They do not need each other.

## Quick start (30 seconds)

You need Claude Code 2.1.288 or later, with mods.

```sh
git clone <github-url> baselane-mods
claude plugin marketplace add "$PWD/baselane-mods"
claude plugin install guard-essentials@baselane-mods
claude plugin install receipt@baselane-mods
```

Start Claude Code. Now it asks before harsh commands, and `/receipt` prints a receipt of the session.

For update, uninstall, options and starter sets, read [docs/INSTALL.md](docs/INSTALL.md).

## How packs work

Most mods have one rule. A pack is one mod with several rules from the same family. For example, `guard-essentials` holds several guards and `band-pack` puts several meters in one band.

- Install a pack when you want the whole set with one command.
- Install single mods when you want only some of the rules.
- Install a pack or its single mods, not both. Each mod has its own copy of its engine, so a rule in two installed mods runs two times. For example, with `guard-pack` and `infra-guard` installed, the `terraform destroy` check runs two times, and you can see two questions.
- Mods from different families combine with no conflict. `guard-essentials`, `cost-meter` and `git-pane` work well together.

The catalog below marks each pack with "pack".

## Safety

- **Guards ask. They do not block.** A guard stops a harsh command and asks you first. You decide. If a guard check fails, it asks you. It does not let the call through without a question.
- **Your data stays on your machine.** No mod sends data out unless you set a destination yourself, such as an ntfy topic for `ntfy-notify` or `long-run-notify`. With a topic set, those mods send a short message only: a generic "needs input" text, or the project name and the seconds.
- **One mod can make a model call, and it is off by default.** `sports-narrator` makes one small model call at the end of a turn that used tools. It sends tool names and file names, never command arguments or file contents. It spends tokens, so you must turn it on.
- **Display mods do not change what Claude reads.** The mods in "Display and render" change only how rows and replies look on your screen. Other families can add text for Claude: prompt styles change how Claude writes, `secret-output-guard` tells Claude not to repeat a credential, and `auto-format` tells Claude to read a file again.
- **Stats stay local.** Streaks, achievements and `/wrapped` read records that the mods keep on your machine.
- **Mods that write files say so.** `/handoff` writes `.claude/handoff.md` and never overwrites it. `session-journal` appends to `~/.claude/journal.log`. `auto-format` runs your project's own formatter. The descriptions say what each mod writes.

## Requirements

- Claude Code 2.1.288 or later, with mods (the plugin function-hook API, in early access).
- Some mods use local tools: git for the git pane, the git band and most commands, and `lsof` for `port-watch` (macOS and most Linux).
- To build from source: Node.js.

## Build and check from source

`plugins/` and `.claude-plugin/marketplace.json` are generated. Do not edit them by hand.

```sh
node scripts/build.mjs          # build one plugin folder per catalog entry
bash scripts/check.sh           # rebuild, then validate, test and type-check every mod
bash scripts/check.sh git-pane  # check only the mods you name
node scripts/gen-docs.mjs       # rewrite the catalog in this README
node --test 'scripts/*.test.mjs'  # test the docs generator
```

A change is done when `check.sh` prints `check: 0 failure(s)`. Read [AGENTS.md](AGENTS.md) for the layout and the API facts.

## Contributing

To add a mod:

1. Add a rule to an engine: `engines/<engine>/hooks/rules/<id>.ts`, with a test in `engines/<engine>/tests/<id>.test.ts`.
2. Add a catalog entry in `catalog/<name>.json`: `{ "name", "description", "rules": ["<id>"] }`. Give the description the slash command, if the mod has one (for example "Open it with /git"). The catalog table reads it from there.
3. Run `node scripts/build.mjs`, then `bash scripts/check.sh <mod>`, then `node scripts/gen-docs.mjs`.

A new engine needs a family in `scripts/gen-docs.mjs`. Keep files small, do not change inputs in place, and do not use the em-dash character.

## Licence

MIT. Copyright (c) 2026 Baselane, LLC. Read [LICENSE](LICENSE).

## Catalog

<!-- catalog:start -->

**112 mods** in 10 families.

"needs setup" means the mod has options that you set with `claude plugin configure <mod>`. Its description tells you if it works before you set them. "pack" means one mod with several rules.

### Guards (25)

Ask you before a harsh or risky command runs.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `secret-filename-guard` | Asks before a Bash command touches a secret-looking file (.env, private keys, credentials). |  |  |
| `secret-guard` | Asks before a live API key, token or private key is written, edited or run. |  |  |
| `env-exfil-guard` | Asks before a command prints your environment, echoes a secret variable or sends local data to a remote host. |  |  |
| `infra-guard` | Asks before terraform destroy, kubectl delete, force-push, DROP TABLE or rm -rf. |  |  |
| `secret-commit-guard` | Asks before a git commit that would record a credential or a secret-named file. |  |  |
| `protect-main` | Asks before a commit, push or merge while you are on main or master. |  |  |
| `gitignore-check` | Asks before git add or commit when secret-looking files are not ignored or are already tracked. |  |  |
| `secret-output-guard` | Tells Claude not to repeat a credential that showed up in command or file output, and names the source to rotate. |  |  |
| `curl-pipe-guard` | Asks before a download is piped into a shell or interpreter (curl \| sh, wget -O- \| bash, bash <(curl ...)). |  |  |
| `sudo-guard` | Asks before sudo, doas or su -c runs a command with elevated rights. |  |  |
| `no-verify-guard` | Asks before git hooks are skipped (--no-verify, commit -n, HUSKY=0, core.hooksPath=/dev/null). |  |  |
| `lockfile-guard` | Asks before a lockfile is written or edited by hand; the package manager should change it. |  |  |
| `package-guard` | Asks before a new dependency is installed (npm, pnpm, yarn, bun, pip, uv, poetry, cargo, go, gem) and names the packages. |  |  |
| `prod-db-guard` | Asks before destructive SQL runs in a command: TRUNCATE, DELETE or UPDATE with no WHERE. |  |  |
| `path-jail` | Asks before Write, Edit or NotebookEdit changes a file outside the working directory, by real path. |  |  |
| `docker-guard` | Asks before Docker commands that delete data: system, volume or image prune, rm -f, volume rm and compose down -v. |  |  |
| `k8s-guard` | Asks before kubectl apply or replace with --force, kubectl drain, helm uninstall, and kubectl delete behind global flags (plain kubectl delete is infra-guard's). |  |  |
| `migration-guard` | Asks before Write or Edit changes a migration that already exists; new migration files pass. |  |  |
| `ci-config-guard` | Asks before Write or Edit changes CI config: .github/workflows, .gitlab-ci.yml or .circleci/config.yml. |  |  |
| `chmod-guard` | Asks before chmod makes files world-writable (777, a+w, o+w) or chmod or chown runs recursively on a broad path (/, a system folder, a home folder). |  |  |
| `git-history-guard` | Asks before git commands that throw away work or rewrite history: reset --hard, clean, rebase, filter-branch, filter-repo, push --delete, branch -D and stash clear. |  |  |
| `big-file-guard` | Asks before a Write creates content over 1 MB, or git add names a file over 5 MB. |  |  |
| `guard-essentials` | Asks only before harsh or disaster commands: destructive infra, git and SQL, piping downloads into a shell, sudo, leaking or committing secrets. The quiet choice for daily work. |  | pack |
| `guard-pack` | Every Baselane guard in one mod. |  | pack |
| `guard-devops` | Asks before harsh DevOps commands: destructive Docker, Kubernetes and Helm calls, CI config edits, world-writable or broad recursive chmod and chown, and git commands that lose work or rewrite history. Add infra-guard for plain kubectl delete. |  | pack |

### Reminders (17)

One quiet toast at turn end when something needs your attention.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `test-reminder` | Reminds you at turn end when source files changed but no test command ran since. |  |  |
| `ctx-nudge` | Reminds you to /clear or /compact when the context window passes 75 percent. |  |  |
| `clippy` | One helpful toast per session per trigger, in the classic paperclip voice: when you edit a migrations folder, a Dockerfile or a GitHub workflow, or run rm -rf. At most one toast per turn. |  |  |
| `sports-narrator` | At turn end, one line of sports play-by-play about what Claude just did. OFF by default: it spends tokens (one small haiku call per turn that used tools), so turn it on with the enabled option in the plugin config. It sends tool names and file names, never commands' arguments or file contents. |  | needs setup |
| `commit-nudge` | Suggests a commit at turn end after 8 or more file edits since the last git commit. One toast per batch of edits; a successful git commit resets the count. |  |  |
| `todo-nudge` | At turn end, one toast with the count of TODO, FIXME and HACK lines your edits added this turn. Quiet when none were added. |  |  |
| `break-nudge` | Suggests a short break once the session has run 90 minutes, and again every 90 minutes after that. |  |  |
| `docs-nudge` | At turn end, one toast when edits added exported code (an export statement in .ts or .js, or a public function signature) and no README or docs file was edited this session. |  |  |
| `debug-print-nudge` | At turn end, one toast naming the count of console.log, print(, debugger and dbg! lines your edits added this turn. Only code files count. |  |  |
| `typecheck-nudge` | At turn end, one toast when .ts or .tsx files were edited and no type check (tsc, vue-tsc, a typecheck script or a build) ran since the last edit. |  |  |
| `lockfile-nudge` | At turn end, one toast when dependencies in package.json, pyproject.toml, Cargo.toml or go.mod changed and neither the matching lockfile was edited nor an install command ran. |  |  |
| `big-diff-nudge` | Suggests splitting the change once your edits added or removed more than 500 lines since the last git commit. A successful commit resets the count. |  |  |
| `migration-nudge` | At turn end, one toast when a schema file changed (schema.prisma, models.py, SQL under schema/, a drizzle schema) and no migration file was created this session. |  |  |
| `env-example-nudge` | At turn end, one toast when edits added a reference to an environment variable (process.env, os.environ, os.getenv, Deno.env) that .env.example does not list. Reads only the names in .env.example, never .env. |  |  |
| `nudge-pack` | Every Baselane turn-end reminder in one mod. |  | pack |
| `focus-pack` | Three quiet nudges in one mod: commit after 8 edits, TODO/FIXME/HACK lines added, and debug prints added. |  | pack |
| `quality-pack` | Three quiet nudges in one mod: type check after TypeScript edits, lockfile after dependency edits, and a split suggestion past 500 changed lines. |  | pack |

### Commands (12)

Slash commands that print a result and, where it helps, copy it.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `receipt` | Adds /receipt: a shareable receipt of the session (tools, files, commands, blocks, context, cost), printed and copied. | `/receipt` |  |
| `standup` | Adds /standup: Yesterday, Today and Blockers from your git log and this session's record, printed and copied. | `/standup` |  |
| `changelog` | Adds /changelog: commits since the last tag (or the last 30), grouped by conventional-commit type, as Markdown. | `/changelog` |  |
| `pr-description` | Adds /pr-description: title, summary, diff totals and a test plan stub for the current branch against main or master. | `/pr-description` |  |
| `handoff` | Adds /handoff: writes a session summary to .claude/handoff.md (never overwriting) and answers with the path. | `/handoff` |  |
| `todos` | Adds /todos: TODO, FIXME and HACK lines in tracked files, grouped by file (50 lines at most). Read-only. | `/todos` |  |
| `loc` | Adds /loc: lines of tracked text files by language, sorted, with a total. Skips lockfiles and binaries. Read-only. | `/loc` |  |
| `hotspots` | Adds /hotspots: the 10 files changed most often in the last 90 days, with change counts. Read-only. | `/hotspots` |  |
| `commit-msg` | Adds /commit-msg: a Conventional Commits message proposed from the staged diff. Heuristic, no model call, writes nothing. | `/commit-msg` |  |
| `branches` | Adds /branches: local branches merged into the default branch or idle for 30 days, as a cleanup list. Never deletes. | `/branches` |  |
| `command-pack` | Every slash command in one mod: /receipt, /standup, /changelog, /pr-description and /handoff. | `/receipt`, `/standup`, `/changelog`, `/pr-description`, `/handoff` | pack |
| `repo-pack` | Five read-only repo commands in one mod: /todos, /loc, /hotspots, /commit-msg and /branches. | `/todos`, `/loc`, `/hotspots`, `/commit-msg`, `/branches` | pack |

### Band meters (13)

A one-line band above the prompt.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `cost-meter` | A band above the prompt with the session cost so far and what the last turn cost. |  |  |
| `latte-meter` | A band above the prompt that counts the session cost in lattes. Set the latte price in the plugin options. |  | needs setup |
| `context-meter` | A band above the prompt with a 10 cell bar of the context window used, yellow from 60 percent, red from 80. |  |  |
| `daily-spend` | A band above the prompt with today's total cost across all your sessions. |  |  |
| `pomodoro` | A band above the prompt with a 25/5 focus timer (focus 18:42, break 03:10). Start and stop it with /pomodoro; a toast marks each switch. | `/pomodoro` |  |
| `mood-ring` | A band above the prompt with a colored dot and a word for the error and block rate of your last 20 tool calls: calm (green) under 10 percent, tense (yellow) under 30, stormy (red) from 30. |  |  |
| `session-clock` | A band above the prompt with the wall clock and how long the session has run (14:05 · 1h 12m). |  |  |
| `branch-band` | A band above the prompt with the git branch and the count of changed files, refreshed after each Bash call and file edit. |  |  |
| `tool-counter` | A band above the prompt with your tool calls this session, the top three by tool (Bash 41 · Edit 18 · Read 12). |  |  |
| `error-meter` | A band above the prompt with how many tool calls failed this session (an error or a deny) and which tool failed last. Red from the first failure. |  |  |
| `model-badge` | A band above the prompt with the current model name and the context percent (opus-4-1 · 62%). |  |  |
| `band-pack` | Every Baselane band meter in one row above the prompt: session cost, lattes, context bar, today's spend, the focus timer and the mood ring. | `/pomodoro` | needs setup, pack |
| `dev-band` | The developer band in one row above the prompt: git branch and changed files, wall clock and session age, tool counts, and failed tool calls. |  | pack |

### Panes (6)

Live side panes that you open with a slash command.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `agent-firewall` | A live pane of every tool call the agent makes: green when it ran, red when it was blocked, with counters. Open it with /firewall. | `/firewall` |  |
| `git-pane` | A live side pane with the branch, ahead and behind its upstream, changed files (staged and unstaged) and the last 5 commits. It refreshes after git commands and file edits. Open it with /git. | `/git` |  |
| `test-pane` | A live side pane with the last test run: runner, pass, fail and skip counts, duration and the first failing tests, read from vitest, jest, pytest, go test, cargo test, bun test and claude plugin test output. Open it with /tests. | `/tests` |  |
| `port-watch` | A live side pane of the local TCP ports that listen, with the process name and pid, refreshed every 10 seconds while open. Reads lsof (macOS, most Linux). Open it with /ports. | `/ports` |  |
| `todo-pane` | A live side pane of the TODO, FIXME and HACK lines in tracked files (git grep), grouped by file and capped at 30. It refreshes after file edits while open. Open it with /todo-pane. | `/todo-pane` |  |
| `cost-pane` | A live side pane with the session cost, the cost of each of the last 10 turns as a bar, and the average per turn. Open it with /cost-pane. | `/cost-pane` |  |

### Prompt styles (20)

Change how Claude writes. Code and commands stay exact.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `terse-mode` | Short answers: no preamble, no recap. |  |  |
| `plain-english` | Writes in ASD-STE-100 Simplified Technical English: short sentences, active voice, simple words. |  |  |
| `junior-mode` | Explains each step and why, and defines jargon once, for a learner. |  |  |
| `reply-language` | Answers in the language you set (English by default). Code, identifiers and commands stay as they are. |  | needs setup |
| `no-sycophancy` | No flattery or filler. Disagreement is stated plainly, with the reason. |  |  |
| `no-em-dash` | Never writes the em-dash character. Uses a comma, colon, period or parentheses. |  |  |
| `pirate-mode` | Talks like a pirate in prose, never inside code, commands or file contents. |  |  |
| `haiku-commits` | Commit messages get a normal conventional-commit first line, then a 5-7-5 haiku about the change in the body. |  |  |
| `conventional-commits` | Commit messages follow Conventional Commits: type(scope): subject, imperative, under 72 characters. |  |  |
| `tdd-mode` | Writes a failing test first, watches it fail, then implements. |  |  |
| `ste-mode` | Replies in ASD-STE100 Simplified Technical English: approved words, short sentences, one instruction each, active voice. |  |  |
| `security-mode` | Checks each change for injection, secrets, authorization and unsafe input, and states the risks it checked. |  |  |
| `yoda-mode` | Speaks like Yoda in prose. Code, commands and commit messages stay normal. |  |  |
| `shakespeare-mode` | Prose in Early Modern English flair. Code, commands, commit messages and error text stay exact. |  |  |
| `caveman-mode` | Prose in short caveman speech ("Fix bug. Test pass."), still accurate. Code and commands stay exact. |  |  |
| `eli5-mode` | Explains like the reader is new: analogies first, no jargon without a one-line definition. |  |  |
| `code-only` | Replies with the code or command first and at most two short sentences of prose, unless asked to explain. |  |  |
| `gitmoji-commits` | Commit messages start with the matching gitmoji (✨ feat, 🐛 fix). Composes with conventional-commits: emoji goes before the type. |  |  |
| `team-pack` | Team habits in one install: Conventional Commits, test-first work and a security check on every change. |  | pack |
| `fun-pack` | Fun habits in one install: caveman prose and gitmoji commit messages. They compose: caveman never touches commit messages. |  | pack |

### Sounds (5)

Short sounds for passing tests, failing tests, blocked calls and turn ends.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `sounds-retro` | 8-bit sounds: a coin when tests pass, a buzz when they fail, a chime when a turn ends. |  | needs setup |
| `sounds-office` | Quiet office sounds: a soft click when tests pass, a low thud when they fail, paper when a call is blocked. |  | needs setup |
| `sounds-scifi` | Sci-fi console sounds: a beep when tests pass, an alarm when they fail, a warp when a turn ends. |  | needs setup |
| `sounds-nature` | Soft nature sounds: a bird chirp when tests pass, a plunk into water when they fail, a gust of wind when a call is blocked, a water drop when a turn ends. |  | needs setup |
| `sounds-minimal` | Very short, quiet clicks and ticks for a subtle signal: a tick when tests pass, two low ticks when they fail, a click when a call is blocked, a soft tick when a turn ends. |  | needs setup |

### Stats (6)

Local records of how you use Claude Code.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `wrapped` | Adds /wrapped: a screenshot-ready Claude Code Wrapped for the last 7 days (or /wrapped month for 30), printed and copied. | `/wrapped` |  |
| `streaks` | Counts consecutive days you used Claude Code: a Day N streak toast at session start, and /streak to ask. | `/streak` |  |
| `achievements` | Unlocks eight badges once each (first session, first green test run, 100 and 1,000 tool calls, 7-day streak, 10 blocked calls, a 2 hour session, night owl), with a toast and /achievements. | `/achievements` |  |
| `night-owl` | Records the hour of each prompt across sessions and adds /hours: a 24-hour histogram of when you work, naming your peak hour. | `/hours` |  |
| `personal-bests` | Tracks your records across sessions (longest session, most tool calls in a session, most files edited in a day, cheapest session over 30 minutes) with a toast when one is beaten, and /bests to list them. | `/bests` |  |
| `stats-pack` | Every Baselane stats mod in one: /wrapped, streaks and achievements on one shared daily rollup. | `/wrapped`, `/streak`, `/achievements` | pack |

### Display and render (3)

Change how rows and replies look on your screen. What Claude reads does not change.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `diff-stats` | Edit and Write rows show a compact +12 -3 bar beside the file name: green for lines added, red for lines removed, up to 20 cells. |  |  |
| `file-links` | In Claude's replies, path/to/file.ts:42 references to files in your project become links. Click one to put @path/to/file.ts in the prompt. |  |  |
| `render-pack` | Every rendering mod in one: diff-stats bars on Edit and Write rows, and file-links in Claude's replies. |  | pack |

### Lifecycle and notify (5)

Act on session events: format files, push a notification, keep a journal.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `auto-format` | Runs your project's own formatter on each file Claude writes or edits, only when the project has a formatter config, and tells Claude to re-read the file. |  |  |
| `long-run-notify` | Sends a phone push through ntfy.sh when a Bash command ran longer than a threshold (60 seconds by default). Sends the project name and the seconds only. Does nothing until you set an ntfy topic. |  | needs setup |
| `ntfy-notify` | Sends a phone push through ntfy.sh when Claude Code needs your input. The message is generic. Does nothing until you set an ntfy topic. |  | needs setup |
| `session-journal` | Appends one line per session end (time, directory, reason) to ~/.claude/journal.log. |  |  |
| `lifecycle-pack` | Every Baselane lifecycle mod in one: auto-format, long-run and input pushes, and the session journal. |  | needs setup, pack |

<!-- catalog:end -->
