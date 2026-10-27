/**
 * Git operations manager.
 *
 * Safety contract (hard rules, do not relax):
 * - Stages and commits ONLY the README file — never `git add -A`, never the
 *   whole working tree. The user's unrelated changes are not ours to commit.
 * - Auto-initializes local git when missing: runs `git init` only when cwd
 *   is not inside any git repository. Sets local fallback identity
 *   (`mastnacek <mastnacek@gmail.com>`) only when no effective identity is set.
 *   Purely local, no remotes/pushes.
 * - Preserves existing repository identity and global identity — never
 *   overwrites user.name/user.email when an effective identity is already set.
 * - Requires the canonical YAML frontmatter in README.md — fixed structure,
   all template fields present (see frontmatter.ts FRONTMATTER_TEMPLATE).
 */

import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { GitCommitInfo } from "./types.js";
import { validateFrontmatterStructure } from "./frontmatter.js";

const README_CANDIDATES = ["README.md", "README.markdown", "README.txt", "README"];

export class GitManager {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async hasRepository(): Promise<boolean> {
    try {
      execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: this.projectRoot,
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure a local git repository exists.
   * If missing, initializes it and sets local fallback identity:
   *   user.name = "mastnacek"
   *   user.email = "mastnacek@gmail.com"
   * only when no effective identity (user.email) is set.
   * Returns true if newly initialized, false if it already existed.
   */
  async ensureRepository(): Promise<boolean> {
    const exists = await this.hasRepository();
    if (!exists) {
      execFileSync("git", ["init"], { cwd: this.projectRoot, stdio: "ignore" });

      if (!this.hasEffectiveEmail()) {
        try {
          execFileSync("git", ["config", "user.name", "mastnacek"], {
            cwd: this.projectRoot,
            stdio: "ignore",
          });
          execFileSync("git", ["config", "user.email", "mastnacek@gmail.com"], {
            cwd: this.projectRoot,
            stdio: "ignore",
          });
        } catch {
          // ignore
        }
      }
    }

    return !exists;
  }

  private hasEffectiveEmail(): boolean {
    try {
      const email = execFileSync("git", ["config", "user.email"], {
        cwd: this.projectRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return Boolean(email && email.trim());
    } catch {
      return false;
    }
  }

  /** First README file present at the project root, or null. */
  async findReadme(): Promise<string | null> {
    for (const candidate of README_CANDIDATES) {
      try {
        await fs.access(join(this.projectRoot, candidate));
        return candidate;
      } catch {
        // try next candidate
      }
    }
    return null;
  }

  /**
   * Stage and commit ONLY the README file.
   *
   * Throws with a precise, agent-actionable message when there is no
   * repository, no README, no frontmatter, or nothing to commit.
   */
  async commitReadme(customMessage?: string): Promise<GitCommitInfo> {
    if (!(await this.hasRepository())) {
      await this.ensureRepository();
    }

    const readme = await this.findReadme();
    if (!readme) {
      throw new Error("No README file found at the project root — write one first.");
    }

    // Validate YAML frontmatter is present
    await this.validateFrontmatter(readme);

    // Stage exactly one file. Pathspec keeps every other dirty file out.
    execFileSync("git", ["add", "--", readme], { cwd: this.projectRoot, stdio: "ignore" });

    const status = execFileSync("git", ["status", "--porcelain", "--", readme], {
      cwd: this.projectRoot,
      encoding: "utf-8",
    });

    if (!status.trim()) {
      return { isFirstCommit: false, files: [], message: "No README changes to commit" };
    }

    const isFirstCommit = !this.hasHistory();
    const message =
      customMessage?.trim() ||
      (isFirstCommit ? "📝 docs: add README" : "📝 docs: update README");

    execFileSync("git", ["commit", "-m", message, "--", readme], {
      cwd: this.projectRoot,
      stdio: "ignore",
    });

    return { isFirstCommit, files: [readme], message };
  }

  private hasHistory(): boolean {
    try {
      execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
        cwd: this.projectRoot,
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates that the README carries the canonical YAML frontmatter:
   * every field of FRONTMATTER_TEMPLATE present, in the fixed structure.
   * Empty values are fine — missing fields are not.
   */
  private async validateFrontmatter(readmeFile: string): Promise<void> {
    const readmePath = join(this.projectRoot, readmeFile);
    const content = await fs.readFile(readmePath, "utf-8");

    const result = validateFrontmatterStructure(content);
    if (!result.ok) {
      throw new Error(
        "README.md frontmatter does not match the canonical template. " +
        "Missing fields: " + result.missing.join(", ") + ". " +
        "Run the readme_generator tool with action \"frontmatter\" to normalize the block " +
        "(it fills every field from a fresh project analysis, preserving any project.* " +
        "values you already wrote), then fill in the empty values."
      );
    }
  }
}
