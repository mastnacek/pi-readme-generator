"""
Pi Project Registry - Project categorization heuristics.
"""

import re
from pathlib import Path
from typing import List

from .registry_io import _normalize_category


# Category indicators: category -> list of keywords/patterns
CATEGORY_INDICATORS = {
    "invoice-extraction": ["invoice", "faktura", "pdf_to_hocr", "tesseract", "ocr"],
    "image-vectorization": ["vectoriz", "embedding", "clip", "vit", "image.*vector"],
    "ocr-tools": ["ocr", "tesseract", "pytesseract", "hocr", "pdf2image"],
    "domino-apps": ["lotus", "notes", "domino", "ls-classmap", "@formula"],
    "video-processing": ["ffmpeg", "handbrake", "video", "transcode"],
    "email-automation": ["gmail", "imap", "smtp", "mail"],
    "calendar-sync": ["calendar", "gcal", "ical"],
    "drive-sync": ["drive", "gdrive", "google.*drive"],
    "pi-plugin": ["pi-coding-agent", "pi-plugin", "pi-lens", "pi-uma"],
    "herdr-plugin": ["herdr", "ratatui", "multiplexer"],
    "web-scraping": ["scrapy", "selenium", "playwright", "beautifulsoup"],
    "data-pipeline": ["etl", "pipeline", "airflow", "dagster"],
    "ml-training": ["train", "pytorch", "tensorflow", "huggingface"],
}


def _analyze_project_for_category(project_path: Path) -> str:
    """Heuristic analysis of project to suggest category."""
    text_parts = []

    # Check key config/doc files
    for fname in ["README.md", "requirements.txt", "pyproject.toml", "package.json", "Cargo.toml", "PROJECT.md"]:
        fpath = project_path / fname
        if fpath.exists():
            try:
                text_parts.append(fpath.read_text(encoding="utf-8", errors="ignore").lower())
            except Exception:
                pass

    # Check Python files for imports
    for py_file in project_path.rglob("*.py"):
        try:
            text_parts.append(py_file.read_text(encoding="utf-8", errors="ignore").lower())
            if len(text_parts) > 10:
                break
        except Exception:
            pass

    full_text = " ".join(text_parts)

    # Score each category
    scores = {}
    for cat, keywords in CATEGORY_INDICATORS.items():
        score = sum(1 for kw in keywords if kw.lower() in full_text)
        if score > 0:
            scores[cat] = score

    if scores:
        return max(scores, key=scores.get)

    return "general"


def _categories_similar(cat1: str, cat2: str) -> bool:
    """Check if two categories are similar enough to be considered the same."""
    return cat1 in cat2 or cat2 in cat1 or cat1 == cat2


def project_registry_categorize(project_path: Path, existing_categories: List[str]) -> str:
    """Analyze project and suggest best category from existing or new."""
    suggested = _analyze_project_for_category(project_path)
    normalized = _normalize_category(suggested)

    # Check if suggested matches an existing category (fuzzy)
    for cat in existing_categories:
        if _categories_similar(normalized, cat):
            return cat

    return normalized