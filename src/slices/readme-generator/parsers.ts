/**
 * Manifest parsing and registry lookup helpers for project analysis.
 */

import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

export const CONFIG_PATTERNS = [
  "package.json", "tsconfig.json", "tsconfig.base.json", "vite.config.ts",
  "webpack.config.js", "rollup.config.js", "esbuild.config.js",
  "Cargo.toml", "Cargo.lock", "pyproject.toml", "requirements.txt",
  "setup.py", "setup.cfg", "Pipfile", "go.mod", "go.sum",
  "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle",
  "composer.json", "Gemfile", "Gemfile.lock", "mix.exs",
  "pubspec.yaml", "CMakeLists.txt", "Makefile", "meson.build",
  ".eslintrc.js", ".eslintrc.json", ".prettierrc", ".prettierrc.json",
  "jest.config.js", "vitest.config.ts", "playwright.config.ts",
  "tailwind.config.js", "postcss.config.js",
];

export const LANGUAGE_MAP: Record<string, string> = {
  "ts": "TypeScript", "tsx": "TypeScript", "js": "JavaScript", "jsx": "JavaScript",
  "py": "Python", "rs": "Rust", "go": "Go", "java": "Java", "kt": "Kotlin",
  "cs": "C#", "cpp": "C++", "cc": "C++", "cxx": "C++", "hpp": "C++",
  "rb": "Ruby", "php": "PHP", "swift": "Swift", "dart": "Dart",
  "lua": "Lua", "r": "R", "scala": "Scala", "clj": "Clojure",
  "hs": "Haskell", "ml": "OCaml", "fs": "F#", "ex": "Elixir", "exs": "Elixir",
};

export function parseCargoToml(content: string): any {
  const result: any = { package: {}, dependencies: {} };
  let currentSection = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1);
      if (!result[currentSection]) result[currentSection] = {};
    } else if (trimmed.includes("=") && !trimmed.startsWith("#")) {
      const [key, value] = trimmed.split("=").map(s => s.trim().replace(/^"|"$/g, ""));
      if (currentSection === "package") {
        result.package[key] = value;
      } else {
        result[currentSection] = result[currentSection] || {};
        result[currentSection][key] = value;
      }
    }
  }
  return result;
}

export function parsePyprojectToml(content: string): any {
  const result: any = { project: {} };
  let currentSection = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1);
      if (!result[currentSection]) result[currentSection] = {};
    } else if (trimmed.includes("=") && !trimmed.startsWith("#")) {
      const [key, value] = trimmed.split("=").map(s => s.trim().replace(/^"|"$/g, ""));
      if (currentSection === "project") {
        result.project[key] = value;
      } else if (currentSection.startsWith("tool.")) {
        result[currentSection] = result[currentSection] || {};
        result[currentSection][key] = value;
      }
    }
  }
  return result;
}

export function normalizeRegistryPath(p: string): string {
  return resolve(p).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

/** Replicates _compute_project_id() from the pi-project-registry skill. */
export async function computeRegistryId(projectRoot: string): Promise<string | undefined> {
  const parts = [basename(projectRoot)];
  try {
    const configText = await fs.readFile(join(projectRoot, ".git", "config"), "utf-8");
    const originMatch = /\[remote "origin"\]\s+url = (.+)/.exec(configText);
    if (originMatch) parts.push(originMatch[1].trim());
    parts.push(configText.slice(0, 500));
  } catch {
    // no .git/config — ID is based on repo name only
  }
  return "sha256:" + createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

/**
 * Look up this project's category in the persistent project registry
 * (~/.pi/projects.json, maintained by the pi-project-registry skill).
 */
export async function lookupRegistryCategory(projectRoot: string): Promise<string | undefined> {
  let registry: any;
  try {
    registry = JSON.parse(await fs.readFile(join(homedir(), ".pi", "projects.json"), "utf-8"));
  } catch {
    return undefined;
  }

  const projects: any[] = Array.isArray(registry?.projects) ? registry.projects : [];
  if (projects.length === 0) return undefined;

  const id = await computeRegistryId(projectRoot);
  if (id) {
    const byId = projects.find(p => p?.id === id);
    if (byId?.category) return byId.category;
  }

  const normalizedRoot = normalizeRegistryPath(projectRoot);
  const byPath = projects.find(p =>
    Array.isArray(p?.paths) &&
    p.paths.some((p2: unknown) => typeof p2 === "string" && normalizeRegistryPath(p2) === normalizedRoot)
  );
  return byPath?.category ?? undefined;
}
