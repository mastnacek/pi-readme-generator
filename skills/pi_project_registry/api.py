"""
Pi Project Registry - Main API module.
"""

from pathlib import Path
from typing import Optional, List, Dict, Any

from .registry_io import (
    project_registry_load,
    project_registry_save,
    _ensure_category,
    _now_iso,
)
from .project_identity import (
    _compute_project_id,
    _get_git_remote,
    _get_git_repo_name,
    project_registry_compute_id,
)
from .categorization import project_registry_categorize


def project_registry_find(project_path: Path) -> Optional[Dict[str, Any]]:
    """Find project by current path or computed ID."""
    registry = project_registry_load()
    project_id = _compute_project_id(project_path)
    abs_path = str(project_path.resolve())

    for proj in registry["projects"]:
        if proj["id"] == project_id:
            return proj
        if abs_path in [str(Path(p).resolve()) for p in proj.get("paths", [])]:
            return proj
    return None


def project_registry_register(
    project_path: Path,
    category: Optional[str] = None,
    name: Optional[str] = None,
    interactive: bool = False
) -> Dict[str, Any]:
    """Register or update project. Returns the project entry.

    If interactive=True and category is None, returns a special dict with
    'needs_category_confirmation': True containing data for ask_user_question.
    The caller should prompt user and call again with confirmed category.
    """
    registry = project_registry_load()
    project_id = _compute_project_id(project_path)
    abs_path = str(project_path.resolve())
    repo_name = name or _get_git_repo_name(project_path)
    git_remote = _get_git_remote(project_path)
    now = _now_iso()

    # Find existing
    existing_idx = None
    for i, proj in enumerate(registry["projects"]):
        if proj["id"] == project_id:
            existing_idx = i
            break

    if existing_idx is not None:
        proj = registry["projects"][existing_idx]
        if abs_path not in proj.get("paths", []):
            proj.setdefault("paths", []).append(abs_path)
        proj["last_seen"] = now
        if git_remote:
            proj["git_remote"] = git_remote
        if category:
            proj["category"] = category
            _ensure_category(registry, category)
        project_registry_save(registry)
        return proj

    # New project - need category
    if not category:
        suggested = project_registry_categorize(project_path, registry["categories"])

        if interactive:
            return {
                "needs_category_confirmation": True,
                "project_id": project_id,
                "repo_name": repo_name,
                "abs_path": abs_path,
                "git_remote": git_remote,
                "now": now,
                "suggested_category": suggested,
                "existing_categories": sorted(registry["categories"]),
                "question_data": _build_category_question(suggested, registry["categories"], repo_name)
            }

        category = suggested

    _ensure_category(registry, category)

    new_proj = {
        "id": project_id,
        "name": repo_name,
        "category": category,
        "paths": [abs_path],
        "last_seen": now,
        "git_remote": git_remote
    }
    registry["projects"].append(new_proj)
    project_registry_save(registry)
    return new_proj


def project_registry_register_confirm(
    project_path: Path,
    confirmed_category: str,
    name: Optional[str] = None
) -> Dict[str, Any]:
    """Complete registration after interactive category confirmation."""
    return project_registry_register(project_path, category=confirmed_category, name=name)


def _build_category_question(suggested: str, existing: List[str], project_name: str) -> Dict[str, Any]:
    """Build ask_user_question payload for category confirmation."""
    options = []

    # Suggested category first
    options.append({
        "label": f"{suggested} (suggested)",
        "description": "LLM-suggested category based on project analysis"
    })

    # Other existing categories
    for cat in existing:
        if cat != suggested:
            options.append({
                "label": cat,
                "description": f"Existing category: {cat}"
            })

    # Custom category option
    options.append({
        "label": "+ New category...",
        "description": "Enter a custom category name"
    })

    return {
        "question": f"What category for project '{project_name}'?",
        "header": "Category",
        "options": options
    }


def project_registry_list_categories() -> List[str]:
    """Return sorted unique categories."""
    registry = project_registry_load()
    return sorted(registry["categories"])


def project_registry_list_projects(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return projects, optionally filtered by category."""
    registry = project_registry_load()
    projects = registry["projects"]
    if category:
        projects = [p for p in projects if p.get("category") == category]
    return sorted(projects, key=lambda p: p.get("last_seen", ""), reverse=True)