---
name: readme-generator
description: Generate or update a high-quality README.md for any project. Use when the user asks to create, write, generate, refresh, or improve a README or project documentation landing page — including via the /readme-gen command. Covers the canonical YAML frontmatter contract, the analyze → draft → write → commit workflow, the git safety rules, and recording a searchable UMA project-anchor fact when the README is done.
---

# README Generator

Write READMEs yourself — the value is YOUR understanding of the code, not a
template. The `readme_generator` tool only gathers facts, scaffolds on explicit
request, and commits the finished file.

## Canonical frontmatter (non-negotiable)

Every README.md MUST start with this exact YAML frontmatter block — all
fields, in this order, in both new and updated READMEs. You fill the values;
the structure is not negotiable (single source of truth:
`FRONTMATTER_TEMPLATE` in `src/slices/readme-generator/frontmatter.ts`):

```yaml
---
project:
  name: <project-name>
  description: <one-sentence description derived from the CODE, not prose>
  language: <primary language>
  category: <category-from-registry>
  framework: <primary framework or "">
  packageManager: <npm|cargo|pip|just|"">
  status: <prototype|in-development|active|production|maintenance|concept|archived>
  quality: <experimental|alpha|beta|stable|mature>
  context: <personal|work>
  progress: <initial|in-progress|feature-complete|completed|paused>
analysis:
  hasGit: <true|false>
  hasReadme: <true|false>
  mainFiles: [<json array>]
  entryPoints: [<json array>]
  configFiles: [<json array>]
  testFiles: [<json array>]
  testFileCount: <number>
  dependencies: [<json array of names>]
  devDependencies: [<json array of names>]
  scripts: {<json object>}
generator:
  tool: "pi-readme-generator"
  version: <plugin version>
  timestamp: <ISO timestamp>
---
```

Rules:
- All fields must be present in every case — use `""` / `[]` / `{}` /
  `false` / `0` for unknown values; never delete a field.
- `analysis.*` values come from `action: "analyze"` output, not guessing.
- `project.*` values (especially `description`) are YOUR job — derive them
  from the code. Existing non-empty `project.*` values are always preserved
  by the plugin's normalization; never regress them to placeholders.
- `generator.*` is machine-managed — do not hand-edit.
- Enforcement: a plugin hook re-normalizes the frontmatter after every
  `write`/`edit` of the root README.md (missing fields are filled from a
  fresh analysis; your non-empty `project.*` values survive). The `commit`
  action normalizes again and REFUSES a non-conforming structure. If you
  need to normalize manually, call `readme_generator` with
  `action: "frontmatter"`.

## Project Evaluation & Context Recognition

The plugin automatically evaluates project metrics and state, providing initial suggestions in `action: "analyze"`. As the LLM agent, you review and refine these fields using your deep semantic understanding of the source code:

### 1. Project Context (`context: personal | work`)
Distinguishes whether the repository is a personal/hobby/open-source effort or an internal/work/enterprise project.
- **`work`**:
  - Purpose: Internal tools, enterprise automation, customer invoicing, ERP integrations, Domino/Lotus Notes business apps, company workflows.
  - Path / repo clues: Paths under corporate directories (e.g., `LN_REA`, company names), internal git remotes, enterprise dependencies (`isdoc`, corporate auth, proprietary SDKs).
  - Domain: Business records, invoicing, employee tooling, domain-specific compliance.
- **`personal`**:
  - Purpose: Independent developer utilities, hobbies, pet projects, experimental scratchpads, games, general open-source CLI tools.
  - Path / repo clues: General personal github repositories, paths under personal dev roots.

### 2. Project State / Status (`status`)
- **`prototype`**: Proof-of-concept, early experiment, initial spike, incomplete core features.
- **`in-development`**: Active feature construction, basic functionality working but evolving rapidly.
- **`active`**: Functional and regularly maintained or used.
- **`production`**: Battle-tested, stable releases (>= 1.0.0), packaged or deployed for actual usage.
- **`maintenance`**: Infrequent updates, bugfixes only, feature-frozen.
- **`concept`**: Ideas, design notes, stub code, architecture sketches.
- **`archived`**: Deprecated, superseded, or abandoned.

### 3. Project Quality (`quality`)
- **`experimental`**: No tests, minimal error handling, exploratory code.
- **`alpha`**: Core logic present but untested edge cases, breaking changes expected.
- **`beta`**: Reasonable test coverage, structured error handling, API stabilizing.
- **`stable`**: Comprehensive tests, CI/linting configured, robust error handling and documentation.
- **`mature`**: Long-term stability, zero major open regressions, extensive test suites and benchmarks.

### 4. Progress (`progress`)
- **`initial`**: Just started, basic scaffold and setup.
- **`in-progress`**: Core functionality being implemented.
- **`feature-complete`**: Planned scope implemented, testing and polishing remaining.
- **`completed`**: Goal achieved, fully delivered.
- **`paused`**: Intentionally put on hold.

1. **Analyze.** Call `readme_generator` with `action: "analyze"` for
   structured facts (language, framework, package manager, entry points,
   scripts, `hasReadme`, `hasGit`).

   **Automatic local git initialization.** If `hasGit` is `false`,
   immediately initialize a local git repository:
   call `readme_generator` with `action: "init-git"` (or execute
   `git init`, and set fallback identity `mastnacek <mastnacek@gmail.com>`
   only if no effective git identity is configured).
   Do this automatically without prompting the user. This ensures the
   local repository exists and commits have an author, while preserving
   any existing work or personal git identity. Then continue with
   `hasGit: true`.

   Then read the files that actually explain the
   project: the manifest (`package.json` / `Cargo.toml` / `pyproject.toml`),
   the entry point, and the source code itself.

   **STRICT RULE — source code only.** When figuring out what the program
   does, NEVER read README.md or any other Markdown/documentation file
   (*.md, *.markdown, docs/, CHANGELOG, ...). Go straight to the source
   code: entry points, main modules, CLI handlers, tests. Docs are
   marketing, frequently stale, and often written by this same template
   machinery — they are not evidence. Every statement in the README you
   write must trace back to code you read, not to prose you read.
   (The single exception: step 2 below, where you read an EXISTING README
   solely to preserve its custom sections during an update — never to
   learn what the program does.)

2. **Register / categorize project (MANDATORY).** Use `pi-project-registry`
   to ensure the project is in the persistent registry with a category.
   This category informs later steps (tone, sections, examples).
   ```python
   from pi_project_registry import project_registry_find, project_registry_register
   from pathlib import Path

   proj = project_registry_find(Path(project_root))
   if not proj:
       # New project — interactive registration with category confirmation
       result = project_registry_register(Path(project_root), interactive=True)
       if result.get("needs_category_confirmation"):
           # Call ask_user_question with result["question_data"]
           # Then call project_registry_register_confirm with user's choice
           pass
       category = result.get("category") or result.get("suggested_category")
   else:
       category = proj["category"]
   ```
   The `category` (e.g., `invoice-extraction`, `ocr-tools`, `domino-apps`)
   drives: audience defaults, section suggestions, badge choices, example style.

3. **Check for an existing README.** If `hasReadme` is true, this is an
   UPDATE, not a rewrite:
   - Read it fully first.
   - Preserve the author's voice, custom sections, badges, screenshots, and
     anything you cannot regenerate.
   - Fix what is stale (install commands, scripts, features) and fill obvious
     gaps. Ask before deleting or restructuring sections.
   - NEVER overwrite an existing README with the scaffold template. The tool
     refuses unless `force: true`, and you may pass `force: true` only when
     the user explicitly asked for a from-scratch template.

4. **Ask before writing (interactive sessions).** Use `ask_user_question`
   when preferences are not obvious:
   - Language of the README (default: English — not the chat's language).
   - Audience and tone (end users vs contributors vs internal) — **pre-filled from category**.
   - Sections beyond the essentials (API docs, screenshots, roadmap, FAQ) — **suggested per category**.
   - Badges, license mention.
   One round of up to 4 questions, not an interrogation; skip what the
   project already answers.

   **Category-driven defaults:**
   | Category | Audience | Typical sections | Badges |
   |----------|----------|------------------|--------|
   | `invoice-extraction` | End users | Install, Usage, JSON output, Troubleshooting | Python, License, Docker |
   | `ocr-tools` | End users | Install, Quickstart, CLI ref, Output formats | Python, License |
   | `domino-apps` | Developers | Install, Agent design, Formula ref, ACL | LotusScript, Domino |
   | `pi-plugin` | Contributors | Architecture, API, Testing, Publishing | TypeScript, Pi, NPM |
   | `ml-training` | Researchers | Install, Data, Training, Evaluation, Models | Python, PyTorch, HF |
   | *other* | End users | Install, Usage, Config | Language, License |

5. **Write the README** with the `write` (new file) or `edit` (update) tool.
   Start with the canonical frontmatter block (see above) — every field
   present, `analysis.*` from the analyze output, `project.*` filled from
   your understanding of the code. When UPDATING an existing README, keep
   its non-empty `project.*` values (especially `description`) unless they
   are genuinely wrong; the normalization hook preserves them, so never
   regress them to placeholders.
   Quality bar:
   - Title + one-paragraph pitch that says WHAT it does and WHO it is for,
     derived from the actual code — never "A <language> project".
   - Install and quick-start commands that really work: verify script names
     and binary names against the manifest, never invent them.
   - Usage examples taken from real entry points or tests.
   - Every claim must be backed by something you read. No placeholder
     sections, no empty headings, no filler ("Contributions are welcome!"
     only if the project invites them).
   - Length matched to the project: a small CLI gets one screen; a framework
     gets more. Omit sections that would be empty.
   - **Category-specific adaptations:** use category to pick tone, depth, examples.

6. **Review before finishing.** Re-read the written file top to bottom.
   Check every command, path, and filename it mentions against the repo.
   Delete anything you cannot verify.

7. **Commit (MANDATORY & AUTOMATIC).** Commits must ALWAYS be made
   automatically once the README is written and verified against the code.
   Do NOT wait for user instruction, do NOT ask for confirmation, and do
   NOT leave the README uncommitted. Call `readme_generator` with
   `action: "commit"` and a clear conventional message, e.g.
   `docs: add README` / `docs: update README`.
   Only the README file is staged.

8. **Summarize for the chat.** After finishing, output a brief summary in the chat window with:
   - Project name and one-line description (what it does, who it's for)
   - Status, quality, progress, and context (`personal` vs `work`)
   - Key tools/scripts/entry points
   - Language, framework, package manager
   - **Project category** (from registry)
   - Commit details (the commit message and files committed)
   - Any notable decisions made during the process (language choice, audience,
     sections added/removed)
   This lets the user see the outcome at a glance without re-reading the file.

9. **Record the UMA project anchor.** The README you just verified against
   the code is the best source for a searchable memory anchor — use it.
   - Call `uma_search` with the project name (hybrid mode, global scope).
   - No anchor yet → call `uma_write`: type `reference`, scope `global`,
     tags `project-anchor` + domain tags (e.g. `domino`, `ocr`, `rust`),
     `staleAfter` ~6 months out. Body: what the project does (1-2 sentences
     from the README pitch), stack, and the characteristic
     techniques/problems it solves — the text a future `uma_search` should
     match when a similar project starts. Reference the registry category.
   - Anchor exists but the README revealed drift (renamed, pivoted,
     re-stacked) → `uma_supersede` the old fact with the revised anchor.
   - Trivial / throwaway / third-party-inspiration projects → skip; the
     store stays clean. When in doubt, ask the user.
   - The write goes through the operator's approval modal — propose, never
     retry a rejected write.

## Git safety rules (non-negotiable)

- Only the README file is ever staged — the tool enforces this. Never work
  around it with your own `git add -A` or `git commit -a`.
- Local git initialization is automatic: when a project lacks a git
  repository, initialize it locally (`git init`) and set the local identity
  to `mastnacek <mastnacek@gmail.com>` only if no effective identity is set.
  This is strictly local — never add remote origins or push automatically.
- If the README has no changes, the tool reports "nothing to commit" — that
  is success, not an error to retry.

## When to use the scaffold

`action: "scaffold"` writes a generic template. Use it only as a starting
skeleton for a brand-new project with no README, and always rewrite its
content against the real code afterwards. For anything the user will read
as-is, write the README yourself.
