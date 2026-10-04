# Install Baselane mods

Every command is a `claude plugin` command from Claude Code 2.1.288 or later, with mods. Inside Claude Code you can type the same commands as `/plugin ...`.

## 1. Get the catalog

```sh
claude plugin marketplace add baselane-sh/mods-catalog
```

This adds the Baselane gallery as a marketplace named `baselane-mods`. The gallery pins each mod to a reviewed commit. Browse it at https://mods.baselane.sh. To make sure, run:

```sh
claude plugin marketplace list
```

## 2. Install mods

Install each mod by its name and the marketplace name:

```sh
claude plugin install guard-essentials@baselane-mods
claude plugin install cost-meter@baselane-mods
```

Then start Claude Code, or restart it if it runs.

By default a mod installs for your user, in every project. To install a mod for one project only, add `--scope project` (shared with the project) or `--scope local` (only you, in this project):

```sh
claude plugin install protect-main@baselane-mods --scope project
```

To see what you have installed:

```sh
claude plugin list
```

Install a pack or its single mods, not both. Each mod runs its own copy of its rules, so a rule in two installed mods runs two times. The catalog in the [README](../README.md#catalog) marks each pack.

## 3. Set options (userConfig)

Some mods have options. The catalog marks them "needs setup". Most options have a default, and the mod works before you set them. Two kinds do nothing until you set them:

- `ntfy-notify` and `long-run-notify` need an ntfy topic. In `lifecycle-pack`, the two push rules need a topic, and the other rules work at once.
- `slack-notify` needs `slackWebhookUrl` (it must start with `https://hooks.slack.com/`). `discord-notify` needs `discordWebhookUrl` (it must start with `https://discord.com/api/webhooks/`).
- `sports-narrator` needs `enabled` set to true. It spends tokens, so it is off by default.

To see the options of a mod and which ones are not set:

```sh
claude plugin configure ntfy-notify@baselane-mods
```

To set an option when you install:

```sh
claude plugin install latte-meter@baselane-mods --config lattePrice=6.5
```

To set options after you install, send them as JSON on stdin. Options that you do not send keep their values:

```sh
claude plugin configure sounds-retro@baselane-mods --values-stdin
```

Type `{"volume": "0.5"}`, then press Enter and Ctrl-D.

### The ntfy topic is a secret

Anyone who knows your ntfy topic can read your notifications. Do not put the topic on the command line, because the shell keeps it in its history. Use the `--values-stdin` form:

```sh
claude plugin configure ntfy-notify@baselane-mods --values-stdin
```

Paste `{"ntfyTopic": "your-long-random-topic"}`, then press Enter and Ctrl-D. You can also use `/plugin` inside Claude Code to set it.

Choose a long, random topic name. Subscribe to the same topic in the ntfy app on your phone.

### Webhook URLs are secrets

Anyone with a Slack or Discord webhook URL can post to your channel. Set it the same way, on stdin:

```sh
claude plugin configure slack-notify@baselane-mods --values-stdin
```

Paste `{"slackWebhookUrl": "<your webhook URL>"}` (or `discordWebhookUrl` for `discord-notify`), then press Enter and Ctrl-D.

## 4. Update

Get the new version of the gallery, then update each mod:

```sh
claude plugin marketplace update baselane-mods
claude plugin update guard-essentials@baselane-mods
```

Restart Claude Code to load the update.

## 5. Uninstall

```sh
claude plugin uninstall cost-meter@baselane-mods
```

Add `--keep-data` to keep the mod's data folder under `~/.claude/plugins/data/`. Add `--scope project` or `--scope local` if you installed the mod with that scope.

To remove the whole catalog:

```sh
claude plugin marketplace remove baselane-mods
```

To stop a mod for a time and keep it installed, use `claude plugin disable <mod>@baselane-mods` and later `claude plugin enable <mod>@baselane-mods`.

## Starter sets

These sets work well together. Install each mod in the set.

### Safe starter

For daily work. It asks before harsh commands and shows what the session costs.

```sh
claude plugin install guard-essentials@baselane-mods
claude plugin install receipt@baselane-mods
claude plugin install cost-meter@baselane-mods
claude plugin install git-pane@baselane-mods
```

- `guard-essentials` asks before destructive infra, git and SQL commands, `curl | sh`, `sudo`, and secret leaks.
- `receipt` adds `/receipt`, a receipt of the session.
- `cost-meter` shows the session cost above the prompt.
- `git-pane` adds `/git`, a live pane with your branch and changed files.

### Fun

For fun in a long session. Pick one sound pack and one voice.

```sh
claude plugin install sounds-retro@baselane-mods
claude plugin install pirate-mode@baselane-mods
claude plugin install wrapped@baselane-mods
```

- Sound packs: `sounds-retro`, `sounds-office`, `sounds-scifi`, `sounds-nature`, `sounds-minimal`. Install only one.
- Voices: `pirate-mode` or `yoda-mode`. Install only one. Code, commands and commit messages stay normal.
- `wrapped` adds `/wrapped`, a recap of your last 7 days, ready for a screenshot.

### More to try

- `latte-meter`: the session cost, in lattes.
- `achievements`: eight badges to unlock, with `/achievements`.
- `agent-firewall`: a live pane of every tool call, with `/firewall`.
- `caveman-mode`: "Fix bug. Test pass."
- `sports-narrator`: one line of play-by-play at turn end. Off by default, because it spends tokens.

The full list is in the [catalog](../README.md#catalog).
