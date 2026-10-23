# Agent Office — working notes

Reads the logs Claude Code and Codex leave behind and animates pixel characters in a browser office, one room per project. UI text is English; the maintainer chats in Korean.

## First run

If `office.json` is missing, empty, or its `home` differs from `echo ~`, treat it as a new person/machine: ask for an office name and a user name, then write `{"building": "…", "user": "…", "home": "<home folder>"}` (the page picks it up within 2 s). The browser setup window does the same. Adding the usage status line to `~/.claude/settings.json` needs the user's permission and a backup first (`settings.json.before-claude-office`); never overwrite an existing `statusLine`.

## Files

| File | Role |
|---|---|
| `server.js` | Tails logs every 0.25 s → events over SSE `/events`. No dependencies (Node 18+) |
| `office.html` | The whole UI: HTML + CSS + JS, canvas isometric renderer |
| `demo.js` | Writes fake sessions to temp dirs and starts the server (`node demo.js`) |
| `tools/build-pages.js` | Builds `index.html` (the GitHub Pages demo, served at jisuhann.github.io/agent-office/) from `office.html` + `docs/replay.json`. `--record` re-records the fake stream from `demo.js` |
| `statusline.js` | Claude Code status line → `usage.json` |
| `office.json`, `usage.json` | Local only, git-ignored |

Run: `node server.js` (port 4777). Flags/env: `--no-open`, `PORT`, `HOST`, `OFFICE_TOKEN`, `CLAUDE_PROJECTS_DIR`, `CODEX_SESSIONS_DIR`, `NO_CODEX=1`. After editing `office.html` reload the browser and rebuild the demo (`node tools/build-pages.js`); after editing `server.js` restart the server.

## Absolute rules

- **Logs are read-only.** Never write, delete or move anything under `~/.claude/projects` or `~/.codex`. Never open `~/.codex/auth.json` or other auth files, nor `.key` files in `~/.claude/sessions`.
- Never delete the user's files; move cleanup candidates to `_to_delete/` and let them delete.
- No token-spending (API-calling) features. This tool only reads local files.
- Bind `127.0.0.1` by default. Remote access is opt-in via `HOST`; the token is opt-in via `OFFICE_TOKEN`.
- Never commit real logs, `office.json`, `usage.json`, tokens, or personal data. The Pages demo must contain fake data only (`tools/build-pages.js` scrubs paths and the user name).

## Server (`server.js`)

- Claude logs: `~/.claude/projects/<encoded cwd>/<session>.jsonl`, sub-agents in `<session>/subagents/*.jsonl` (`applyLine()` / `applySub()`).
- Codex logs: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (`.zst` skipped). First line `session_meta` has `id`, `cwd`, `parent_thread_id` for sub-agents; `guardian_review` threads are shown as the reviewer.
- Event kinds `k`: `tool` (room, tool, detail), `think`, `say`, `error`, `wait`, `user`, `spawn`, `agentTool`, `agentErr`, `agentDone`, `board`. A `snap` event (floors, sessions, usage, setup) is sent every 2 s when something changed.
- A "floor" = a working folder; Claude and Codex in the same folder (or one inside the other) share it. The page matches floors to rooms by `f.name`.
- Keep parsing inside `try/catch` — log formats change between versions.

## UI (`office.html`)

- One global-world canvas at scale 1: a 30×17 slab with two big 12-wide rooms on top (`skillchaining`, `robotics-safety`; local x 3–15, so `ox` is -3 / 9) and a small paved terrace at the top right, a hall (`LANE`), and three small rooms (`legal-ai`, `brainstorm`, `jisu`) plus the Lounge below. Iso projection `P(x,y,z)`; furniture is registered with `add()` and painted in one pass sorted by `x+y`.
- `PROJ` (top of the script) defines rooms: name, colour, origin, door. Per-project colour drives floors, wall bands, door mats, stripes, the ring under the feet, name tags and `.olab` borders (`--c`).
- Routing: `route()` / `inner()` / `roomAt()`; helpers enter and leave through `agentHome()`. Idle > 25 s → desk, > 40 s → `loungeSpot()` with a ☕ badge.
- Characters are 14×18 chibi pixel sprites (big head, sparkly eyes, blush; `drawPerson`), `avatar(kind)` makes the label portraits. Labels are DOM (`.olab`, `renderLabels` / `placeLabels`, clamped into the stage).
- Font is Helvetica Neue (system font, no web-font links). Clouds/rain are disabled (`SHOW_CLOUDS = false`) because they covered the rooms; the sun/stars still show.
- `PUBLIC_VIEW=1` (server): `redact()` is an **allowlist** applied in `broadcast()` and to the first `/events` snapshot. When you add a field to `snapshot()` or an event, add it to `redact()` only if it carries no content (prompts, paths, file/command text, ids → `hid()`). Test: run a public instance and a normal one on the same logs, collect every string from the normal stream and assert none appears in the public stream (this once caught `day.prompts`/`day.files` and path-bearing session keys).
- The Pages page (`tools/build-pages.js`) tries the live PUBLIC_VIEW stream (`LIVE_URL`, default the author's Tailscale Funnel host) first and falls back to the fake replay on error/7 s silence; the server allows that origin via `PUBLIC_ORIGIN`. Test with `LIVE_URL=http://127.0.0.1:<port>/events` + a matching `PUBLIC_ORIGIN`, and with a dead URL for the fallback.
- A clock (`#clock`, seconds) sits in the LIVE pill so you can see the page is alive.
- Privacy mode `body.priv` blurs names and task text; add new personal-content elements to its selector list.
- Verify UI changes in a real browser (screenshots), not just by reading code: `node demo.js --no-open`, then check overlap/clipping at several viewport sizes.
