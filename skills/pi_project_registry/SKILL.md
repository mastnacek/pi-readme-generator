---
name: pi-project-registry
description: Persistent project registry in ~/.pi/projects.json with git-based identity, content-hash tracking, and LLM-assisted single-level categorization.
---

# Pi Project Registry

Persistent registry of projects stored in `~/.pi/projects.json`. Uses git config + repo name as stable identifier (survives folder moves). Single-level categories (e.g., "invoice-extraction", "image-vectorization"). Heuristic analysis suggests category for new projects; user confirms interactively via `ask_user_question`.

## Data Model

```json
{
  "version": 1,
  "projects": [
    {
      "id": "sha256:.git/config+repo-name",
      "name": "my-project",
      "category": "invoice-extraction",
      "paths": ["D:/01_programovani/hocr", "E:/projects/hocr"],
      "last_seen": "2026-01-15T10:30:00Z",
      "git_remote": "https://github.com/user/repo.git"
    }
  ],
  "categories": ["invoice-extraction", "image-vectorization", "ocr-tools", "domino-apps"]
}
```

## Skill API (for other skills/agents)

### `project_registry_load()`
Load registry, return parsed JSON. Creates file with defaults if missing.

### `project_registry_save(registry)`
Write registry to disk atomically.

### `project_registry_compute_id(project_path)`
Compute stable project ID from `.git/config` + repo name.

### `project_registry_find(project_path)`
Look up project by current path (checks `paths` array) or by computing ID.

### `project_registry_register(project_path, category?, name?, interactive=False)`
Register or update project.
- If `category` provided: registers directly.
- If `category` omitted and `interactive=False`: uses heuristic suggestion, registers immediately.
- If `category` omitted and `interactive=True`: returns dict with `needs_category_confirmation=True` containing `question_data` for `ask_user_question`. Caller should prompt user, then call `project_registry_register_confirm()`.

### `project_registry_register_confirm(project_path, confirmed_category, name?)`
Complete registration after interactive category confirmation.

### `project_registry_categorize(project_path, existing_categories)`
Analyze project (README, entry points, source) and suggest category from existing list or new one.

### `project_registry_list_categories()`
Return sorted unique categories.

### `project_registry_list_projects(category?)`
Return projects, optionally filtered by category.

## Interactive Flow (Pi Agent)

```python
from pi_project_registry import project_registry_register, project_registry_register_confirm
from pathlib import Path

# Step 1: Register with interactive=True
result = project_registry_register(Path.cwd(), interactive=True)

if result.get("needs_category_confirmation"):
    # Step 2: Present question_data to user via ask_user_question
    question_data = result["question_data"]
    # -> call ask_user_question(question_data)
    # user selects: "ocr-tools (suggested)" or existing category or "+ New category..."
    
    # Step 3: If user chose "New category...", get free-text input
    # Step 4: Confirm registration
    confirmed_category = ...  # from user selection
    project = project_registry_register_confirm(Path.cwd(), confirmed_category)
```

The `question_data` dict matches `ask_user_question` format:
```json
{
  "question": "What category for project 'hocr'?",
  "header": "Category",
  "options": [
    {"label": "ocr-tools (suggested)", "description": "LLM-suggested..."},
    {"label": "invoice-extraction", "description": "Existing category: invoice-extraction"},
    {"label": "+ New category...", "description": "Enter a custom category name"}
  ]
}
```

## CLI Usage

```bash
# Register current project (non-interactive, uses heuristic)
python -m pi_project_registry register

# List all projects
python -m pi_project_registry list

# List categories
python -m pi_project_registry categories

# Show registry file
python -m pi_project_registry show

# Find project in cwd
python -m pi_project_registry find
```

## Implementation Notes

- **ID computation**: Read `.git/config`, extract `[remote "origin"] url` + repo dir name → SHA256 hex prefix 16 chars.
- **Path tracking**: Maintain `paths` array with all seen locations; dedupe.
- **Category normalization**: lowercase, kebab-case, max 30 chars.
- **Heuristic categorization**: Scans README, requirements.txt, pyproject.toml, package.json, Cargo.toml, PROJECT.md, and *.py imports against keyword indicators.
- **Atomic write**: Write to temp file + rename.
- **Concurrency**: File lock via `.lock` sidecar (optional, single-user typical).

## Example Flow

1. User runs `pi project-registry register` in `D:/01_programovani/hocr`
2. Skill computes ID from `.git/config` + `hocr`
3. Checks registry – not found
4. Analyzes project: finds `pdf_to_hocr.py`, `parse_hocr.py`, Tesseract deps
5. Heuristic suggests: "ocr-tools" (existing) or "pdf-ocr-pipeline" (new)
6. If interactive: user selects via `ask_user_question`
7. Registry updated with new project entry
8. Future: user moves project to `E:/work/hocr` → skill finds by ID, adds path to `paths[]`

## Integration Points

- `list_projects` / `search_projects` tools: can cross-reference registry for categories
- `readme-generator`: can read category to tailor README tone/sections
- Custom skills: import `project_registry_*` functions via skill loading mechanism