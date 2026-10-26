"""
Pi Project Registry - CLI entry point.
"""

import sys
import json
from pathlib import Path

from .api import (
    project_registry_register,
    project_registry_list_categories,
    project_registry_list_projects,
    project_registry_find,
)
from .registry_io import project_registry_load


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m pi_project_registry <command> [args]")
        print("Commands: register, list, categories, show, find")
        sys.exit(1)

    cmd = sys.argv[1]
    cwd = Path.cwd()

    if cmd == "register":
        cat = sys.argv[2] if len(sys.argv) > 2 else None
        proj = project_registry_register(cwd, cat)
        if proj.get("needs_category_confirmation"):
            print("Interactive confirmation needed - use from Pi agent")
            print(f"Suggested: {proj['suggested_category']}")
            print(f"Existing: {proj['existing_categories']}")
        else:
            print(f"Registered: {proj['name']} ({proj['id']}) -> {proj['category']}")

    elif cmd == "list":
        cat = sys.argv[2] if len(sys.argv) > 2 else None
        projs = project_registry_list_projects(cat)
        for p in projs:
            paths = ", ".join(p["paths"][:2])
            print(f"  {p['name']} [{p['category']}] {p['id']} -> {paths}")

    elif cmd == "categories":
        cats = project_registry_list_categories()
        for c in cats:
            print(f"  {c}")

    elif cmd == "show":
        registry = project_registry_load()
        print(json.dumps(registry, indent=2, ensure_ascii=False))

    elif cmd == "find":
        proj = project_registry_find(cwd)
        if proj:
            print(json.dumps(proj, indent=2, ensure_ascii=False))
        else:
            print("Not found")

    else:
        print(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()