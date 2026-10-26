# AGENTS.md

<!-- BEST-OF-AI-DEV template v1. Canonical rules for every agent and human in this repo.
     CLAUDE.md, GEMINI.md and any other vendor file point here and add nothing else.
     Keep this file at or under 70 lines. Long detail goes in RULES.md or docs/. -->

## What this repo is

grocery-list is a static, mobile-first PWA grocery list (plain HTML/CSS/JS, no build step,
no dependencies, no backend) served from GitHub Pages at https://mogesjohnson.github.io/grocery-list/.

## Commands

Run these from the repo root. They are the only definition of "checks pass".

- Syntax check: `for f in *.js; do node --check "$f"; done`
- Manifest is valid JSON: `node -e "JSON.parse(require('fs').readFileSync('manifest.webmanifest','utf8'))"`
- Run locally: `python3 -m http.server 8000`, then open http://localhost:8000/

## Where things live

- `index.html`, `styles.css`, `app.js`: the whole app shell.
- `manifest.webmanifest`, `sw.js`, `icons/`: PWA install and offline support.
- `.github/pull_request_template.md`: the PR report format.

## How work flows

1. Every change starts from a task or an issue with acceptance criteria.
2. One task, one branch: `<agent>/<short-topic>`, off fresh `main`.
3. Small PRs: at most 600 changed lines; aim under 400.
4. Conventional Commits: lowercase `type(scope): subject`, at most 72 characters.
   End each commit with `Refs: #N` (or the task) and `Agent: <name>` trailers.
5. The PR template is the report. Fill every section; untick what you did not check.
6. Merge commits only (`gh pr merge --merge`). Never squash or rebase-merge.

## Done means

- The checks above pass, and the output was read, not assumed.
- Each result is reported as `pass`, `fail`, `blocked` or `not_run`. Never round up.
- Docs that describe the changed behavior are updated in the same PR.

## Hard rules

Read RULES.md before your first commit. The short version:

- Never commit secrets, `.env*`, personal paths or raw transcripts.
- Never force-push, rewrite pushed history, or use `--no-verify`.
- Ask before adding a dependency, a build step, CI or a backend.

## Repo-specific rules

- All paths are relative so the app works under `/grocery-list/` on Pages.
- Bump `CACHE` in `sw.js` whenever a cached shell file changes.
- Data lives only in the browser (localStorage). Schema changes bump `SCHEMA_VERSION` and migrate.
