# pi-readme-generator

> Pi plugin for skill-driven README generation: the agent writes the README, the plugin supplies facts and a safe README-only commit.

## What it does

- **`/readme-gen [instructions]`** — hands the request to the agent with a pointer to the bundled `readme-generator` skill. The agent analyzes the project, asks about preferences, writes/updates `README.md` itself, and automatically commits it. Optional free-text argument is forwarded to the agent (e.g. `/readme-gen in Czech, add badges`).
- **`readme_generator` tool** — actions:
  - `analyze` — read-only structured facts about the project (language, framework, package manager, entry points, scripts, `hasReadme`, `hasGit`) and project health evaluation (status: `prototype` / `production`, quality: `experimental` / `stable`, context: `personal` / `work`, progress: `in-progress` / `completed`).
  - `init-git` — ensures local git repository exists with identity `mastnacek <mastnacek@gmail.com>`.
  - `frontmatter` — normalizes frontmatter structure to the canonical YAML schema (project metadata, evaluation tags, analysis facts, and generator details).
  - `scaffold` — writes a generic template `README.md`; refuses to overwrite an existing one unless `force: true`.
  - `commit` — stages and commits **only the README file** using the repository's git identity (auto-initializes local git if missing).
- **`readme-generator` skill** — the workflow the agent follows: analyze → respect existing README → ask preferences → write → verify → automatic commit.

## Safety rules

- Never `git add -A` — unrelated dirty files in your working tree stay untouched.
- Never changes git config — your real `user.name`/`user.email` is used.
- Auto-initializes local git when missing — runs `git init` and sets local identity to `mastnacek <mastnacek@gmail.com>`. Purely local: never creates remotes or pushes.
- The scaffold template never silently overwrites an existing README.

## Development

```bash
npx tsc --noEmit   # typecheck
npm test           # compile + node --test dist/test/*.test.js
```

Layout: thin `index.ts` composition root + `src/shared/` (i18n, state) + `src/slices/readme-generator/` (analyzer, readme-builder, git-manager, commands, tools) + `skills/readme-generator/SKILL.md`.
