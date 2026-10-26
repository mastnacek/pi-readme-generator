/**
 * Project quality, status, context, and progress evaluator.
 */

import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { basename, join, resolve } from "node:path";

export interface GitDetails {
  commitCount: number;
  lastCommit: string;
  remoteUrl: string;
}

export async function checkCI(projectRoot: string, files: string[]): Promise<boolean> {
  const ciPaths = [
    ".github/workflows",
    ".gitlab-ci.yml",
    "azure-pipelines.yml",
    ".circleci",
    "Jenkinsfile",
    ".travis.yml",
  ];
  for (const p of ciPaths) {
    try {
      await fs.access(join(projectRoot, p));
      return true;
    } catch {
      // continue
    }
  }
  return files.some(f => f.includes(".github/workflows") || f.includes(".gitlab-ci.yml"));
}

export async function checkLicense(projectRoot: string, files: string[]): Promise<boolean> {
  const licenseNames = ["license", "license.md", "license.txt", "licence", "licence.md", "copying"];
  for (const name of licenseNames) {
    try {
      await fs.access(join(projectRoot, name));
      return true;
    } catch {
      // continue
    }
  }
  return files.some(f => {
    const lower = basename(f).toLowerCase();
    return lower.startsWith("license") || lower.startsWith("licence") || lower === "copying";
  });
}

export function checkTypes(files: string[], language: string): boolean {
  const staticTypedLanguages = [
    "TypeScript", "Rust", "Go", "Java", "Kotlin", "C#", "C++",
    "Swift", "Dart", "Scala", "Haskell", "OCaml", "F#",
  ];
  if (staticTypedLanguages.includes(language)) return true;
  return files.some(f =>
    f === "tsconfig.json" || f.endsWith(".d.ts") || f.endsWith("py.typed")
  );
}

export function getGitDetails(projectRoot: string): GitDetails {
  let commitCount = 0;
  let lastCommit = "";
  let remoteUrl = "";

  try {
    const countStr = execFileSync("git", ["rev-list", "--count", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    commitCount = parseInt(countStr, 10) || 0;
  } catch {
    commitCount = 0;
  }

  try {
    lastCommit = execFileSync("git", ["log", "-1", "--format=%cI"], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    lastCommit = "";
  }

  try {
    remoteUrl = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    remoteUrl = "";
  }

  return { commitCount, lastCommit, remoteUrl };
}

/**
 * Distinguishes between "work" and "personal" projects based on domain keywords,
 * technology stack (Domino/LotusScript, ERP, ISDOC), remote repository origin,
 * and folder naming.
 */
export function evaluateContext(
  projectRoot: string,
  files: string[],
  language: string,
  dependencies: Record<string, string> = {},
  remoteUrl: string = "",
): "work" | "personal" {
  const rootNormalized = resolve(projectRoot).replace(/\\/g, "/").toLowerCase();
  const remoteLower = remoteUrl.toLowerCase();

  // Known work/enterprise folder patterns
  const workPathClues = [
    "ln_rea", "domino", "lotusscript", "orsoft", "isdoc",
    "work", "client", "company", "enterprise", "b2b",
  ];
  if (workPathClues.some(clue => rootNormalized.includes(clue))) return "work";

  // Remote repositories belonging to enterprise/corporate remotes
  if (remoteLower && !remoteLower.includes("mastnacek") &&
     (remoteLower.includes("gitlab") || remoteLower.includes("bitbucket") || remoteLower.includes("corp"))) {
    return "work";
  }

  // Technology stack: Lotus Notes / Domino enterprise stack
  const isDominoOrLotusScript = files.some(f =>
    f.endsWith(".lss") || f.endsWith(".dxl") || f.endsWith(".nsf") ||
    f.endsWith(".formula") || f.endsWith(".fl")
  ) || language === "LotusScript";
  if (isDominoOrLotusScript) return "work";

  // Enterprise dependencies / domain indicators
  const allDepKeys = Object.keys(dependencies).map(k => k.toLowerCase());
  const isEnterpriseDomain = allDepKeys.some(dep =>
    dep.includes("orsoft") || dep.includes("isdoc") || dep.includes("oracle") || dep.includes("sap")
  );
  if (isEnterpriseDomain) return "work";

  return "personal";
}

/**
 * Evaluates the project status / state keyword:
 * concept | prototype | in-development | active | production | maintenance | archived
 */
export function evaluateStatus(
  commitCount: number,
  hasTests: boolean,
  version?: string,
): string {
  if (commitCount <= 1 && !hasTests) return "prototype";

  if (version) {
    const cleanVer = version.replace(/^v/i, "").trim();
    const parts = cleanVer.split(".");
    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);

    if (major >= 1) {
      return commitCount >= 10 && hasTests ? "production" : "active";
    }
    if (major === 0 && minor >= 2) {
      return "in-development";
    }
    if (major === 0 && minor < 2) {
      return "prototype";
    }
  }

  if (commitCount >= 25 && hasTests) return "active";
  if (commitCount >= 5) return "in-development";
  return "prototype";
}

/**
 * Evaluates the quality tier:
 * experimental | alpha | beta | stable | mature
 */
export function evaluateQuality(
  testFileCount: number,
  hasCI: boolean,
  hasTypes: boolean,
  hasLicense: boolean,
  hasReadme: boolean,
  commitCount: number,
): string {
  let score = 0;
  if (testFileCount > 0) score += 1;
  if (testFileCount >= 3) score += 1;
  if (hasCI) score += 1;
  if (hasTypes) score += 1;
  if (hasLicense) score += 1;
  if (hasReadme) score += 1;
  if (commitCount >= 10) score += 1;
  if (commitCount >= 30) score += 1;

  if (score >= 7) return "mature";
  if (score >= 5) return "stable";
  if (score >= 3) return "beta";
  if (score >= 2) return "alpha";
  return "experimental";
}

/**
 * Evaluates progress keyword:
 * initial | in-progress | feature-complete | completed | maintenance
 */
export function evaluateProgress(
  commitCount: number,
  status: string,
  quality: string,
): string {
  if (commitCount <= 2) return "initial";
  if (status === "production" || quality === "mature") return "completed";
  if (status === "active" || quality === "stable") return "feature-complete";
  if (status === "maintenance" || status === "archived") return "maintenance";
  return "in-progress";
}
