"""
Pi Project Registry - Project identification (stable ID computation).
"""

import hashlib
import subprocess
import re
from pathlib import Path
from typing import Optional


def _compute_project_id(project_path: Path) -> str:
    """Compute stable project ID from .git/config + repo name."""
    git_config = project_path / ".git" / "config"
    repo_name = project_path.name

    content_parts = [repo_name]
    if git_config.exists():
        try:
            config_text = git_config.read_text(encoding="utf-8")
            origin_match = re.search(r'\[remote "origin"\]\s+url = (.+)', config_text)
            if origin_match:
                content_parts.append(origin_match.group(1).strip())
            content_parts.append(config_text[:500])
        except Exception:
            pass

    combined = "|".join(content_parts)
    return "sha256:" + hashlib.sha256(combined.encode()).hexdigest()[:16]


def _get_git_remote(project_path: Path) -> Optional[str]:
    """Get git remote origin URL."""
    try:
        result = subprocess.run(
            ["git", "config", "--get", "remote.origin.url"],
            cwd=project_path,
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def _get_git_repo_name(project_path: Path) -> str:
    """Get repository name from git or folder name."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=project_path,
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return Path(result.stdout.strip()).name
    except Exception:
        pass
    return project_path.name


def project_registry_compute_id(project_path: Path) -> str:
    """Public API: compute project ID."""
    return _compute_project_id(project_path)