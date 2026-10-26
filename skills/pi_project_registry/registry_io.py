"""
Pi Project Registry - Data models and registry I/O.
"""

import json
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


REGISTRY_PATH = Path.home() / ".pi" / "projects.json"


def _ensure_registry_dir():
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)


def project_registry_load() -> Dict[str, Any]:
    """Load registry from disk, create defaults if missing."""
    _ensure_registry_dir()

    if not REGISTRY_PATH.exists():
        default = {
            "version": 1,
            "projects": [],
            "categories": []
        }
        project_registry_save(default)
        return default

    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        backup = REGISTRY_PATH.with_suffix(f".json.bak.{datetime.now().strftime('%Y%m%d%H%M%S')}")
        shutil.move(str(REGISTRY_PATH), str(backup))
        default = {"version": 1, "projects": [], "categories": []}
        project_registry_save(default)
        return default


def project_registry_save(registry: Dict[str, Any]) -> None:
    """Save registry atomically."""
    _ensure_registry_dir()

    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=REGISTRY_PATH.parent,
        delete=False,
        suffix=".tmp"
    ) as tmp:
        json.dump(registry, tmp, ensure_ascii=False, indent=2)
        tmp_path = Path(tmp.name)

    try:
        tmp_path.replace(REGISTRY_PATH)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise


def _ensure_category(registry: Dict[str, Any], category: str) -> None:
    """Add category to registry if not present."""
    normalized = _normalize_category(category)
    if normalized not in registry["categories"]:
        registry["categories"].append(normalized)
        registry["categories"].sort()


def _normalize_category(cat: str) -> str:
    """Normalize category: lowercase, kebab-case, max 30 chars."""
    import re
    cat = cat.lower().strip()
    cat = re.sub(r"[^a-z0-9]+", "-", cat)
    cat = cat.strip("-")
    return cat[:30]


def _now_iso() -> str:
    """Current UTC time in ISO format with Z suffix."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")