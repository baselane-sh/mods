# Baselane mods

Small mods for Claude Code. Pick the ones you want and combine them.

Baselane mods are Claude Code plugins made of function hooks. Each mod does one thing: a guard that asks before `rm -rf`, a band with the session cost, a side pane with your git status, a sound when tests pass, a pirate voice for Claude's prose. There are 100+ mods in families such as guards, panes, meters, sounds and stats. Install one, or stack ten. They do not need each other.

## Quick start (30 seconds)

You need Claude Code 2.1.288 or later, with mods.

```sh
claude plugin marketplace add baselane-sh/mods-catalog
claude plugin install guard-essentials@baselane-mods
claude plugin install receipt@baselane-mods
```

Start Claude Code. Now it asks before harsh commands, and `/receipt` prints a receipt of the session.

Browse every mod at https://baselane-sh.github.io/mods-catalog/. The gallery (`baselane-mods`) pins each mod to a reviewed commit, so a new mod reaches the gallery a short time after it reaches this repo. For update, uninstall, options and starter sets, read [docs/INSTALL.md](docs/INSTALL.md).

This repo also has a development marketplace, `baselane-mods-dev`, that tracks `main`. Use it only to try changes that are not released yet:

```sh
claude plugin marketplace add baselane-sh/mods
claude plugin install <name>@baselane-mods-dev
```

Each mod is released with a git tag `<name>--v<version>`.

## How packs work

Most mods have one rule. A pack is one mod with several rules from the same family. For example, `guard-essentials` holds several guards and `band-pack` puts several meters in one band.

- Install a pack when you want the whole set with one command.
- Install single mods when you want only some of the rules.
- Install a pack or its single mods, not both. Each mod has its own copy of its engine, so a rule in two installed mods runs two times. For example, with `guard-pack` and `infra-guard` installed, the `terraform destroy` check runs two times, and you can see two questions.
- Mods from different families combine with no conflict. `guard-essentials`, `cost-meter` and `git-pane` work well together.

The catalog below marks each pack with "pack".

## Safety

- **Guards ask. They do not block.** A guard stops a harsh command and asks you first. You decide. If a guard check fails, it asks you. It does not let the call through without a question.
- **Your data stays on your machine.** No mod sends data out unless you set a destination yourself, such as an ntfy topic for `ntfy-notify` or `long-run-notify`, or a webhook URL for `slack-notify` or `discord-notify`. With a destination set, those mods send a short message only: a generic "needs input" text with the project folder name, or the project name and the seconds. One exception needs no setup: `ci-band` and `ops-band` ask GitHub, through your own gh login, for the latest Actions run of your branch every 2 minutes, sending the repository and branch name. Without gh, or with gh not logged in, they do nothing.
- **One mod can make a model call, and it is off by default.** `sports-narrator` makes one small model call at the end of a turn that used tools. It sends tool names, file names and the first two words of each shell command, never file contents. It spends tokens, so you must turn it on.
- **Display mods do not change what Claude reads.** The mods in "Display and render" change only how rows and replies look on your screen. Other families can add text for Claude: prompt styles change how Claude writes, `secret-output-guard` tells Claude not to repeat a credential, and `auto-format` and `auto-lint` tell Claude to read a file again.
- **Stats stay local.** Streaks, achievements and `/wrapped` read records that the mods keep on your machine.
- **Mods that write files say so.** `/handoff` writes `.claude/handoff.md` and never overwrites it. `session-journal` appends to `~/.claude/journal.log`. `auto-format` and `auto-lint` run your project's own formatter or linter fix, which can rewrite files. The descriptions say what each mod writes.

## Requirements

- Claude Code 2.1.288 or later, with mods (the plugin function-hook API, in early access). Read the [Claude Code mods docs](https://code.claude.com/docs/en/plugins/mods/overview).
- Some mods use local tools: git for the git pane, the git band and most commands, `lsof` for `port-watch`, `gh` for `ci-band`, `ps` for `process-pane`, and on macOS `pmset` for `battery-band` and `pgrep` with `osascript` for `now-playing`.
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

**180 mods** in 10 families.

"needs setup" means the mod has options that you set with `claude plugin configure <mod>`. Its description tells you if it works before you set them. "pack" means one mod with several rules.

### Guards (35)

Ask you before a harsh or risky command runs.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `secret-filename-guard` | Asks before a Bash command touches a secret-looking file (.env, private keys, credentials). |  |  |
| `secret-guard` | Asks before a live API key, token or private key is written, edited or run. |  |  |
| `env-exfil-guard` | Asks before a command prints your environment, echoes a secret variable or sends local data to a remote host. |  |  |
| `infra-guard` | Asks before terraform destroy, kubectl delete, force-push, DROP TABLE or rm -rf. |  |  |
| `secret-commit-guard` | Asks before a git commit that would record a credential or a secret-named file. Reads the staged diff with git. |  |  |
| `protect-main` | Asks before a commit, push or merge while you are on main or master. Reads the branch with git. |  |  |
| `gitignore-check` | Asks before git add or commit when secret-looking files are not ignored or are already tracked. Checks with git ls-files. |  |  |
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
| `big-file-guard` | Asks before a Write creates content over 1 MB, or git add names a file over 5 MB. Measures the files with find. |  |  |
| `publish-guard` | Asks before a package is published: npm, pnpm, yarn or bun publish, cargo publish, twine upload, gem push, poetry or uv publish. Dry runs pass. |  |  |
| `tag-guard` | Asks before release tags go to a remote: git push --tags, --follow-tags or --mirror, a push of a tag ref, and a push that deletes a remote tag. Dry runs pass. Reads tags with git. |  |  |
| `deploy-guard` | Asks before a production deploy: vercel --prod, netlify deploy --prod, firebase deploy, fly deploy, gcloud app deploy, eb deploy, heroku rollback, serverless deploy to prod. |  |  |
| `db-reset-guard` | Asks before a framework wipes a database: prisma migrate reset, rails or rake db:drop and db:reset, alembic downgrade, django flush, supabase db reset, knex rollback --all. |  |  |
| `ssh-guard` | Asks before a private key in .ssh is read, authorized_keys or the SSH config is changed, or ssh-keygen would overwrite a key. Public keys and ssh -i pass. Reads HOME with printenv. |  |  |
| `cron-guard` | Asks before scheduled jobs or services are wiped or stopped: crontab -r, crontab replaced from stdin or a file, launchctl unload or bootout, systemctl stop, disable or mask. |  |  |
| `upload-guard` | Asks before local files go to a remote host: scp or rsync to host:path, piped input to nc, curl -T, sftp put. Local copies, downloads and localhost pass. |  |  |
| `registry-push-guard` | Asks before an image or chart is pushed to a registry: docker push, docker buildx --push, podman push, helm push, gcloud artifacts docker push. Local registries pass. |  |  |
| `guard-essentials` | Asks only before harsh or disaster commands: destructive infra, git and SQL, piping downloads into a shell, sudo, leaking or committing secrets. Reads git. The quiet choice for daily work. |  | pack |
| `guard-pack` | The 15 core Baselane guards in one mod (secrets, git, infra, packages, path jail). Some read git, measure files with find, read HOME with printenv, or check where a path really lands. |  | pack |
| `guard-devops` | Asks before harsh DevOps commands: destructive Docker, Kubernetes and Helm calls, CI config edits, broad chmod and chown, and git commands that lose work. Add infra-guard for plain kubectl delete. |  | pack |
| `release-pack` | Asks before a release leaves your machine: package publish, tag push, production deploy and registry push guards in one mod. The tag guard reads tags with git. |  | pack |
| `ship-safe-pack` | The release-pack guards plus db-reset-guard and upload-guard: asks before publish, tag push, production deploy, registry push, database wipes and file uploads. Reads tags with git. |  | pack |

### Reminders (17)

One quiet toast at turn end when something needs your attention.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `test-reminder` | Reminds you at turn end when source files changed but no test command ran since. |  |  |
| `ctx-nudge` | Reminds you to /clear or /compact when the context window passes 75 percent. |  |  |
| `clippy` | One helpful toast per session per trigger, in the classic paperclip voice: when you edit a migrations folder, a Dockerfile or a GitHub workflow, or run rm -rf. At most one toast per turn. |  |  |
| `sports-narrator` | One line of sports play-by-play at turn end. OFF by default: one haiku call per turn with tools. Turn on the enabled option. Sends tool names, file names and the first two words of each command. |  | needs setup |
| `commit-nudge` | Suggests a commit at turn end after 8 or more file edits since the last git commit. One toast per batch of edits; a successful git commit resets the count. |  |  |
| `todo-nudge` | At turn end, one toast with the count of TODO, FIXME and HACK lines your edits added this turn. Quiet when none were added. |  |  |
| `break-nudge` | Suggests a short break once the session has run 90 minutes, and again every 90 minutes after that. |  |  |
| `docs-nudge` | At turn end, one toast when edits added exported code (an export statement in .ts or .js, or a public function signature) and no README or docs file was edited this session. |  |  |
| `debug-print-nudge` | At turn end, one toast naming the count of console.log, print(, debugger and dbg! lines your edits added this turn. Only code files count. |  |  |
| `typecheck-nudge` | At turn end, one toast when .ts or .tsx files were edited and no type check (tsc, vue-tsc, a typecheck script or a build) ran since the last edit. |  |  |
| `lockfile-nudge` | At turn end, one toast when dependencies in package.json, pyproject.toml, Cargo.toml or go.mod changed and neither the matching lockfile was edited nor an install command ran. |  |  |
| `big-diff-nudge` | Suggests splitting the change once your edits added or removed more than 500 lines since the last git commit. A successful commit resets the count. |  |  |
| `migration-nudge` | At turn end, one toast when a schema file changed (schema.prisma, models.py, SQL under schema/, a drizzle schema) and no migration file was created this session. |  |  |
| `env-example-nudge` | At turn end, one toast when edits add a reference to an environment variable (process.env, os.environ, os.getenv, Deno.env) that .env.example does not list. Reads only .env.example names, never .env. |  |  |
| `nudge-pack` | Two turn-end reminders in one mod: test-reminder and ctx-nudge. |  | pack |
| `focus-pack` | Three quiet nudges in one mod: commit after 8 edits, TODO/FIXME/HACK lines added, and debug prints added. |  | pack |
| `quality-pack` | Three quiet nudges in one mod: type check after TypeScript edits, lockfile after dependency edits, and a split suggestion past 500 changed lines. |  | pack |

### Commands (28)

Slash commands that print a result and, where it helps, copy it.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `receipt` | Adds /receipt: a shareable receipt of the session (tools, files, commands, blocks, context, cost), printed and copied. | `/receipt` |  |
| `standup` | Adds /standup: Yesterday, Today and Blockers from your git log and this session's record, printed and copied. | `/standup` |  |
| `changelog` | Adds /changelog: commits since the last tag (or the last 30), read with git log and grouped by conventional-commit type, as Markdown. | `/changelog` |  |
| `pr-description` | Adds /pr-description: title, summary, diff totals and a test plan stub for the current branch against main or master, read with git. | `/pr-description` |  |
| `handoff` | Adds /handoff: writes a session summary with the git status to .claude/handoff.md (never overwriting) and answers with the path. | `/handoff` |  |
| `todos` | Adds /todos: TODO, FIXME and HACK lines in tracked files, found with git grep, grouped by file (50 lines at most). Read-only. | `/todos` |  |
| `loc` | Adds /loc: lines of tracked text files by language, read with git, sorted, with a total. Skips lockfiles and binaries. Read-only. | `/loc` |  |
| `hotspots` | Adds /hotspots: the 10 files changed most often in the last 90 days, from git log, with change counts. Read-only. | `/hotspots` |  |
| `commit-msg` | Adds /commit-msg: a Conventional Commits message proposed from the staged diff, read with git. Heuristic, no model call, writes nothing. | `/commit-msg` |  |
| `branches` | Adds /branches: local branches merged into the default branch or idle for 30 days, as a cleanup list, read with git. Never deletes. | `/branches` |  |
| `tree` | Adds /tree: tracked files (git ls-files) as a tree, 2 levels deep, folders with file counts (80 lines at most). Read-only. | `/tree` |  |
| `deps` | Adds /deps: direct dependencies with versions from package.json, pyproject.toml, requirements.txt, go.mod and Cargo.toml at the git repo root. No network, no audit. Read-only. | `/deps` |  |
| `authors` | Adds /authors: the top 15 contributors by commit count with their last commit date, from git log. Names only, never email addresses. Read-only. | `/authors` |  |
| `scripts` | Adds /scripts: runnable tasks from package.json scripts, Makefile targets, justfile recipes and pyproject scripts at the git repo root. Read-only. | `/scripts` |  |
| `env-check` | Adds /env-check: variable names in .env.example against .env at the git repo root, listing missing and extra names. Reads names only, never a value. Read-only. | `/env-check` |  |
| `size` | Adds /size: the 15 largest tracked files and the total tracked size at HEAD, read with git. Read-only. | `/size` |  |
| `licenses` | Adds /licenses: the licence of each direct dependency, from node_modules and Python dist-info at the git repo root. Shows unknown when it cannot tell. Read-only. | `/licenses` |  |
| `conflicts` | Adds /conflicts: tracked files that still hold merge conflict markers, with line numbers, found with git grep. Read-only. | `/conflicts` |  |
| `secret-scan` | Adds /secret-scan: tracked files and line numbers that hold secret-shaped text, found with git grep. Never prints a matched value. Read-only. | `/secret-scan` |  |
| `envinfo` | Adds /envinfo: versions of git, node, npm, python3, go, rustc and docker if installed, by running each (2 s limit), and the OS. Read-only. | `/envinfo` |  |
| `stashes` | Adds /stashes: git stashes with their age and the branch each was made on. Read-only, never applies or drops. | `/stashes` |  |
| `recent` | Adds /recent: your last 15 commits across all local branches (author is git user.name), with branch and date. Read-only. | `/recent` |  |
| `file-owners` | Adds /owners <path>: the top 5 authors of a file or folder by lines, from git blame. Names only, never addresses. Read-only. | `/owners` |  |
| `readme-check` | Adds /readme-check: which common README sections are missing (install, usage, licence, contributing) and which relative links are broken, at the git repo root. Read-only. | `/readme-check` |  |
| `command-pack` | The five original slash commands in one mod: /receipt, /standup, /changelog, /pr-description and /handoff. They read git; /handoff also writes .claude/handoff.md. | `/receipt`, `/standup`, `/changelog`, `/pr-description`, `/handoff` | pack |
| `repo-pack` | Five read-only repo commands in one mod: /todos, /loc, /hotspots, /commit-msg and /branches. They read git. | `/todos`, `/loc`, `/hotspots`, `/commit-msg`, `/branches` | pack |
| `explore-pack` | Five read-only repo exploration commands in one mod: /tree, /deps, /authors, /scripts and /env-check. They read git and project files. | `/tree`, `/deps`, `/authors`, `/scripts`, `/env-check` | pack |
| `audit-pack` | Three read-only audit commands in one mod: /secret-scan, /conflicts and /licenses. They read git, project files and dependency folders. | `/secret-scan`, `/conflicts`, `/licenses` | pack |

### Band meters (23)

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
| `branch-band` | A band above the prompt with the git branch and the count of changed files, read with git status after each Bash call and file edit. |  |  |
| `tool-counter` | A band above the prompt with your tool calls this session, the top three by tool (Bash 41 · Edit 18 · Read 12). |  |  |
| `error-meter` | A band above the prompt with how many tool calls failed this session (an error or a deny) and which tool failed last. Red from the first failure. |  |  |
| `model-badge` | A band above the prompt with the current model name and the context percent (opus-4-1 · 62%). |  |  |
| `turn-timer` | A band above the prompt with how long the current turn has run (turn 0:42). It shows while a turn runs and hides between turns. |  |  |
| `ahead-behind` | A band above the prompt with the commits ahead and behind the upstream (↑2 ↓1), read with git status after each Bash call and file edit. Hidden when the branch has no upstream. |  |  |
| `battery-band` | A band above the prompt with the Mac battery percent and charging state (🔋 87%, ⚡ 54% while charging), read from pmset once a minute. Hidden on other systems. |  |  |
| `now-playing` | A band above the prompt with the track Music or Spotify plays on your Mac (♪ Song - Artist), read with pgrep and osascript once a minute, only from a player that runs. Hidden when nothing plays. |  |  |
| `ci-band` | A band above the prompt with the latest GitHub Actions run of your branch (ci passed, ci failed, ci running), asked of the gh CLI every 2 minutes; branch read with git. Hidden without gh. |  |  |
| `todo-count` | A band above the prompt with how many lines in tracked files hold TODO, FIXME or HACK (todo 12), counted with git after edits. Hidden when there are none. |  |  |
| `cache-meter` | A band above the prompt with the share of prompt tokens the cache served this session (cache 87%). A high share means cheaper, faster turns. |  |  |
| `streak-flame` | A band above the prompt with your daily streak, the days in a row you finished a turn (🔥 5d). The mod keeps the count in its own store. |  |  |
| `band-pack` | The first six Baselane band meters in one row above the prompt: session cost, lattes, context bar, today's spend, the focus timer and the mood ring. | `/pomodoro` | needs setup, pack |
| `dev-band` | The developer band in one row above the prompt: git branch and changed files (read with git status), wall clock and session age, tool counts, and failed tool calls. |  | pack |
| `creator-band` | The creator band in one row above the prompt: turn timer, count of TODO, FIXME and HACK lines (read with git), and the daily streak flame. |  | pack |
| `ops-band` | The ops band in one row above the prompt: commits ahead and behind the upstream (git), the latest GitHub Actions run of your branch (gh), and the Mac battery (pmset). |  | pack |

### Panes (10)

Live side panes that you open with a slash command.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `agent-firewall` | A live pane of every tool call the agent makes: green when it ran, red when it was blocked, with counters. Open it with /firewall. | `/firewall` |  |
| `git-pane` | A live side pane, read with git: the branch, ahead and behind its upstream, changed files (staged and unstaged) and the last 5 commits. Refreshes after git commands and edits. Open it with /git. | `/git` |  |
| `test-pane` | A live side pane with the last test run (vitest, jest, pytest, go test, cargo test, bun test, claude plugin test): runner, pass, fail and skip counts, duration and first failures. Open it with /tests. | `/tests` |  |
| `port-watch` | A live side pane of the local TCP ports that listen, with the process name and pid, refreshed every 10 seconds while open. Reads lsof (macOS, most Linux). Open it with /ports. | `/ports` |  |
| `todo-pane` | A live side pane of the TODO, FIXME and HACK lines in tracked files (git grep), grouped by file and capped at 30. It refreshes after file edits while open. Open it with /todo-pane. | `/todo-pane` |  |
| `cost-pane` | A live side pane with the session cost, the cost of each of the last 10 turns as a bar, and the average per turn. Open it with /cost-pane. | `/cost-pane` |  |
| `files-pane` | A live side pane of the files Claude read, edited or wrote this session, grouped by action with a count per file, newest first. Open it with /files. | `/files` |  |
| `timeline-pane` | A live side pane of this session's turns, newest first: start time, length, tool calls and cost of each, with a total. Open it with /timeline. | `/timeline` |  |
| `context-pane` | A live side pane of how full the context window is: the percent as a bar, the tokens used, and a short tip past 75 percent. Open it with /context-pane. | `/context-pane` |  |
| `process-pane` | A live side pane of the processes the session's Bash calls started that still run, with pid, age and command. Read-only: one ps every 5 seconds. Open it with /procs. | `/procs` |  |

### Prompt styles (28)

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
| `socratic-mode` | For learning: answers a question with a short hint and one guiding question first, and gives the full answer when you ask. Code and commands stay exact. |  |  |
| `rubber-duck` | Restates the problem in its own words and lists its assumptions before it starts work. |  |  |
| `reviewer-mode` | After each code change, reviews its own diff like a strict senior reviewer and lists each issue it found and fixed. |  |  |
| `docstring-mode` | Every new or changed public function gets a short doc comment in the language's normal style. |  |  |
| `noir-mode` | Prose like a hard-boiled detective narrator, light and clear. Code, commands, commit messages and error text stay exact. |  |  |
| `bullet-mode` | Replies as short bullet lists, at most one sentence per bullet, unless you ask for code. |  |  |
| `british-english` | British spelling and terms in prose (colour, organise, licence as a noun). Code identifiers stay as they are. |  |  |
| `team-pack` | Team habits in one install: Conventional Commits, test-first work and a security check on every change. |  | pack |
| `fun-pack` | Fun habits in one install: caveman prose and gitmoji commit messages. They compose: caveman never touches commit messages. |  | pack |
| `mentor-pack` | Mentor habits in one install: a hint and a guiding question first, assumptions listed before work, and a strict self-review after each change. |  | pack |

### Sounds (7)

Short sounds for passing tests, failing tests, blocked calls and turn ends.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `sounds-retro` | 8-bit sounds: a coin when tests pass, a buzz when they fail, a chime when a turn ends. |  | needs setup |
| `sounds-office` | Quiet office sounds: a soft click when tests pass, a low thud when they fail, paper when a call is blocked. |  | needs setup |
| `sounds-scifi` | Sci-fi console sounds: a beep when tests pass, an alarm when they fail, a warp when a turn ends. |  | needs setup |
| `sounds-nature` | Soft nature sounds: a bird chirp when tests pass, a plunk into water when they fail, a gust of wind when a call is blocked, a water drop when a turn ends. |  | needs setup |
| `sounds-minimal` | Very short, quiet clicks and ticks for a subtle signal: a tick when tests pass, two low ticks when they fail, a click when a call is blocked, a soft tick when a turn ends. |  | needs setup |
| `sounds-zen` | Soft bells and singing-bowl tones: a bell when tests pass, a low bowl when they fail, a muted chime when a call is blocked, a bowl when a turn ends. |  | needs setup |
| `sounds-arcade` | Arcade blips: a coin when tests pass, a game-over drop when they fail, a buzz when a call is blocked, a power-up when a turn ends. |  | needs setup |

### Stats (9)

Local records of how you use Claude Code.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `wrapped` | Adds /wrapped: a screenshot-ready Claude Code Wrapped for the last 7 days (or /wrapped month for 30), printed and copied. | `/wrapped` |  |
| `streaks` | Counts consecutive days you used Claude Code: a Day N streak toast at session start, and /streak to ask. | `/streak` |  |
| `achievements` | Unlocks eight badges once each (first session, first green test run, 100 and 1,000 tool calls, 7-day streak, 10 blocked calls, a 2 hour session, night owl), with a toast and /achievements. | `/achievements` |  |
| `night-owl` | Records the hour of each prompt across sessions and adds /hours: a 24-hour histogram of when you work, naming your peak hour. | `/hours` |  |
| `personal-bests` | Tracks your records across sessions (longest session, most tool calls in a session, most files edited in a day, cheapest session over 30 minutes), toasts a new one, and lists them with /bests. | `/bests` |  |
| `heatmap` | Adds /heatmap: a 12-week calendar grid of the days you used Claude Code, like a contribution graph, shaded by turns, naming your busiest day. | `/heatmap` |  |
| `langs` | Counts the file types Claude edits across sessions and adds /langs: a bar list of the types edited most, each file counted once per session. | `/langs` |  |
| `weekly` | Adds /week: this week (since Monday) against last week, with sessions, turns, tool calls, files edited and cost, and the change for each. | `/week` |  |
| `stats-pack` | The three original stats mods in one: /wrapped, streaks and achievements on one shared daily rollup. | `/wrapped`, `/streak`, `/achievements` | pack |

### Display and render (12)

Change how rows and replies look on your screen. What Claude reads does not change.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `diff-stats` | Edit and Write rows show a compact +12 -3 bar beside the file name: green for lines added, red for lines removed, up to 20 cells. |  |  |
| `file-links` | In Claude's replies, path/to/file.ts:42 references to files in your project become links. Click one to put @path/to/file.ts in the prompt. |  |  |
| `time-badge` | Tool rows show how long the call ran, for example 2.4s, when it took over one second. The time is the tool's own run time, without permission prompts. |  |  |
| `exit-badge` | A failed Bash row shows a small red badge with its exit code, for example exit 2. |  |  |
| `json-pretty` | Bash output that is one long line of JSON is drawn pretty-printed, folded after 30 lines. Display only: Claude reads the output as it was. |  |  |
| `url-links` | https links (and http://localhost) in tool output are listed as clickable links under the result, up to five. Display only: Claude reads the output as it was. |  |  |
| `size-badge` | Read and Write rows show how much was read or written: the line count, for example 312 lines, or the file size for images and PDFs. |  |  |
| `sha-links` | Commit SHAs in Claude's replies, and in the output of git commands, become links to the commit page when origin is on GitHub or GitLab. Display only. |  |  |
| `issue-links` | #123 references in Claude's replies become links to that issue when the repository's origin is on GitHub or GitLab. Display only. |  |  |
| `path-shorten` | Tool rows draw long absolute file paths shorter: the project root as ./ and your home folder as ~. Display only; Bash commands are drawn as they ran. |  |  |
| `render-pack` | Both original rendering mods in one: diff-stats bars on Edit and Write rows, and file-links in Claude's replies (a click puts @path in the prompt). |  | pack |
| `render-plus` | Three row badges in one: time-badge, exit-badge and size-badge. |  | pack |

### Lifecycle and notify (11)

Act on session events: format files, push a notification, keep a journal.

| Mod | What it does | Command | Notes |
| --- | --- | --- | --- |
| `auto-format` | Runs your project's own formatter on each file Claude writes or edits, only when the project has a formatter config, and tells Claude to re-read the file. |  |  |
| `long-run-notify` | Sends a phone push through ntfy.sh when a Bash command ran longer than a threshold (60 seconds by default). Sends the project name and the seconds only. Does nothing until you set an ntfy topic. |  | needs setup |
| `ntfy-notify` | Sends a phone push through ntfy.sh when Claude Code needs your input. The message is generic. Does nothing until you set an ntfy topic. |  | needs setup |
| `session-journal` | Appends one line per session end (time, directory, reason) to ~/.claude/journal.log. |  |  |
| `desktop-notify` | Shows a desktop notification when Claude Code needs your input: osascript on macOS, notify-send elsewhere when it is installed. The text is the project name and a short status only. |  |  |
| `slack-notify` | Posts to a Slack incoming webhook when Claude Code needs your input. Sends the project name and a short status only. Does nothing until you set a webhook URL. |  | needs setup |
| `discord-notify` | Posts to a Discord webhook when Claude Code needs your input. Sends the project name and a short status only. Does nothing until you set a webhook URL. |  | needs setup |
| `say-done` | On macOS, speaks "Claude is done" with the say command when a turn ends after more than 30 seconds. Does nothing on other platforms. |  |  |
| `auto-lint` | Runs your project's own linter fix (eslint, ruff or golangci-lint) on each file Claude writes or edits, only when the project has that linter's config, and tells Claude what is left. |  |  |
| `lifecycle-pack` | The four original lifecycle mods in one: runs your formatter, sends ntfy.sh pushes for long commands and input waits, and appends to ~/.claude/journal.log. |  | needs setup, pack |
| `notify-pack` | Local alerts in one: a desktop notification when Claude Code needs your input (osascript or notify-send), and a spoken line (say) on macOS when a long turn ends. |  | pack |

<!-- catalog:end -->
