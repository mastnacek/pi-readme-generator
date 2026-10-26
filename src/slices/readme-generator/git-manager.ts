/**
 * Git operations manager.
 *
 * Safety contract (hard rules, do not relax):
 * - Stages and commits ONLY the README file — never `git add -A`, never the
 *   whole working tree. The user's unrelated changes are not ours to commit.
 * - Never touches git config (user.name / user.email). The repository's
 *   existing identity is used as-is.
 * - Never initializes a repository on its own — git init is a user decision.
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
      await fs.access(join(this.projectRoot, ".git"));
      return true;
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
      throw new Error(
        "No git repository in this project. Ask the user before running `git init` — never initialize a repository on your own."
      );
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
