---
name: readme-generator
description: Generate or update a high-quality README.md for any project. Use when the user asks to create, write, generate, refresh, or improve a README or project documentation landing page — including via the /readme-gen command. Covers the analyze → draft → write → optional commit workflow and the git safety rules.
---

# README Generator

Write READMEs yourself — the value is YOUR understanding of the code, not a
template. The `readme_generator` tool only gathers facts, scaffolds on explicit
request, and commits the finished file.

## Workflow

1. **Analyze.** Call `readme_generator` with `action: "analyze"` for
   structured facts (language, framework, package manager, entry points,
   scripts, `hasReadme`). Then read the files that actually explain the
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

7. **Commit — only if the user wants it.** If the user asked for a commit
   (or confirms when you offer), call `readme_generator` with
   `action: "commit"` and a clear conventional message, e.g.
   `docs: add README` / `docs: refresh install instructions`.
   Show the user the message first when in doubt.

8. **Summarize for the chat.** After finishing (whether committed or not),
   output a brief summary in the chat window with:
   - Project name and one-line description (what it does, who it's for)
   - Key tools/scripts/entry points
   - Language, framework, package manager
   - **Project category** (from registry)
   - Whether a commit was made (and the commit hash/message if so)
   - Any notable decisions made during the process (language choice, audience,
     sections added/removed)
   This lets the user see the outcome at a glance without re-reading the file.

## Git safety rules (non-negotiable)

- Only the README file is ever staged — the tool enforces this. Never work
  around it with your own `git add -A` or `git commit -a`.
- Never change git config (user.name/user.email) — the repo's identity is used.
- Never run `git init` without the user's explicit approval. If there is no
  repository, the commit action will refuse; report that and ask.
- If the README has no changes, the tool reports "nothing to commit" — that
  is success, not an error to retry.

## When to use the scaffold

`action: "scaffold"` writes a generic template. Use it only as a starting
skeleton for a brand-new project with no README, and always rewrite its
content against the real code afterwards. For anything the user will read
as-is, write the README yourself.
