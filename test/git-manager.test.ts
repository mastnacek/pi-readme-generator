import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GitManager } from "../src/slices/readme-generator/git-manager.js";
import { ProjectAnalyzer } from "../src/slices/readme-generator/analyzer.js";
import { registerReadmeGeneratorTools } from "../src/slices/readme-generator/tools.js";
import { createInitialState } from "../src/shared/state.js";

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(join(tmpdir(), prefix));
  return dir;
}

async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

describe("GitManager", () => {
  describe("hasRepository", () => {
    it("detects repository at root", async () => {
      const dir = await createTempDir("git-test-root-");
      try {
        execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
        const gm = new GitManager(dir);
        assert.equal(await gm.hasRepository(), true);
      } finally {
        await removeDir(dir);
      }
    });

    it("detects repository from a nested subdirectory", async () => {
      const rootDir = await createTempDir("git-test-parent-");
      try {
        execFileSync("git", ["init"], { cwd: rootDir, stdio: "ignore" });
        const subDir = join(rootDir, "databaze", "data__lidskeZdroje");
        await fs.mkdir(subDir, { recursive: true });

        const gm = new GitManager(subDir);
        assert.equal(await gm.hasRepository(), true);
      } finally {
        await removeDir(rootDir);
      }
    });

    it("returns false for a non-repository directory", async () => {
      const nonRepoDir = await createTempDir("git-test-none-");
      try {
        // Prevent git from searching upwards to any repo that contains tmpdir
        // git rev-parse in an empty directory without parent git repo
        const gm = new GitManager(nonRepoDir);
        // In some environments, tmpdir itself might or might not be in a git repo.
        // Let's verify rev-parse status directly.
        let isGit = false;
        try {
          execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: nonRepoDir, stdio: "ignore" });
          isGit = true;
        } catch {
          isGit = false;
        }
        assert.equal(await gm.hasRepository(), isGit);
      } finally {
        await removeDir(nonRepoDir);
      }
    });
  });

  describe("ensureRepository", () => {
    it("does not create a nested git repository when cwd is a subdirectory of a repo", async () => {
      const rootDir = await createTempDir("git-test-parent-");
      try {
        execFileSync("git", ["init"], { cwd: rootDir, stdio: "ignore" });
        const subDir = join(rootDir, "nsfodp-export", "databaze", "data__lidskeZdroje");
        await fs.mkdir(subDir, { recursive: true });

        const gm = new GitManager(subDir);
        const created = await gm.ensureRepository();

        assert.equal(created, false, "Should return false as repository already exists in parent hierarchy");
        let hasNestedGit = false;
        try {
          await fs.access(join(subDir, ".git"));
          hasNestedGit = true;
        } catch {
          hasNestedGit = false;
        }
        assert.equal(hasNestedGit, false, "Subdirectory must not contain its own .git folder");
      } finally {
        await removeDir(rootDir);
      }
    });

    it("preserves existing identity in an existing repository", async () => {
      const repoDir = await createTempDir("git-test-identity-");
      try {
        execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });
        execFileSync("git", ["config", "user.name", "Corporate Dev"], { cwd: repoDir, stdio: "ignore" });
        execFileSync("git", ["config", "user.email", "corp.dev@enterprise.com"], { cwd: repoDir, stdio: "ignore" });

        const gm = new GitManager(repoDir);
        const created = await gm.ensureRepository();

        assert.equal(created, false, "Repository already existed");

        const name = execFileSync("git", ["config", "user.name"], { cwd: repoDir, encoding: "utf-8" }).trim();
        const email = execFileSync("git", ["config", "user.email"], { cwd: repoDir, encoding: "utf-8" }).trim();

        assert.equal(name, "Corporate Dev", "Existing user.name must not be overwritten");
        assert.equal(email, "corp.dev@enterprise.com", "Existing user.email must not be overwritten");
      } finally {
        await removeDir(repoDir);
      }
    });

    it("preserves existing identity even when called from a nested subdirectory of an existing repo", async () => {
      const rootDir = await createTempDir("git-test-sub-id-");
      try {
        execFileSync("git", ["init"], { cwd: rootDir, stdio: "ignore" });
        execFileSync("git", ["config", "user.name", "Work Author"], { cwd: rootDir, stdio: "ignore" });
        execFileSync("git", ["config", "user.email", "author@workplace.cz"], { cwd: rootDir, stdio: "ignore" });

        const subDir = join(rootDir, "sub", "project");
        await fs.mkdir(subDir, { recursive: true });

        const gm = new GitManager(subDir);
        const created = await gm.ensureRepository();

        assert.equal(created, false);

        const email = execFileSync("git", ["config", "user.email"], { cwd: subDir, encoding: "utf-8" }).trim();
        assert.equal(email, "author@workplace.cz");
      } finally {
        await removeDir(rootDir);
      }
    });
  });

  describe("commitReadme in nested subdirectory", () => {
    it("commits README from a subdirectory without initializing a nested repo", async () => {
      const rootDir = await createTempDir("git-test-commit-sub-");
      try {
        execFileSync("git", ["init"], { cwd: rootDir, stdio: "ignore" });
        execFileSync("git", ["config", "user.name", "Tester"], { cwd: rootDir, stdio: "ignore" });
        execFileSync("git", ["config", "user.email", "tester@example.com"], { cwd: rootDir, stdio: "ignore" });

        // Initial root commit
        await fs.writeFile(join(rootDir, "init.txt"), "hello");
        execFileSync("git", ["add", "--", "init.txt"], { cwd: rootDir, stdio: "ignore" });
        execFileSync("git", ["commit", "-m", "initial commit"], { cwd: rootDir, stdio: "ignore" });

        // Create sub directory
        const subDir = join(rootDir, "services", "worker");
        await fs.mkdir(subDir, { recursive: true });

        // Write conforming README.md in subDir
        const readmeContent = [
          "---",
          "project:",
          '  name: "worker"',
          '  description: "Worker service"',
          '  language: "TypeScript"',
          '  category: "service"',
          '  framework: ""',
          '  packageManager: "npm"',
          '  status: "prototype"',
          '  quality: "experimental"',
          '  context: "work"',
          '  progress: "in-progress"',
          "analysis:",
          "  hasGit: true",
          "  hasReadme: true",
          "  mainFiles: []",
          "  entryPoints: []",
          "  configFiles: []",
          "  testFiles: []",
          "  testFileCount: 0",
          "  dependencies: []",
          "  devDependencies: []",
          "  scripts: {}",
          "generator:",
          '  tool: "pi-readme-generator"',
          '  version: "0.5.0"',
          '  timestamp: "2026-10-27T12:00:00.000Z"',
          "---",
          "",
          "# worker",
          "",
          "Worker service documentation.",
        ].join("\n");
        await fs.writeFile(join(subDir, "README.md"), readmeContent, "utf-8");

        const gm = new GitManager(subDir);
        const info = await gm.commitReadme("docs: add worker readme");

        assert.equal(info.files.length, 1);
        assert.equal(info.files[0], "README.md");

        // Verify no nested .git in subDir
        let hasNestedGit = false;
        try {
          await fs.access(join(subDir, ".git"));
          hasNestedGit = true;
        } catch {
          hasNestedGit = false;
        }
        assert.equal(hasNestedGit, false, "Subdirectory must not contain a .git directory");

        // Verify commit happened in parent repo
        const log = execFileSync("git", ["log", "-1", "--format=%s"], { cwd: subDir, encoding: "utf-8" }).trim();
        assert.equal(log, "docs: add worker readme");
      } finally {
        await removeDir(rootDir);
      }
    });
  });

  describe("ProjectAnalyzer in nested subdirectory", () => {
    it("detects git repository from a nested subdirectory", async () => {
      const rootDir = await createTempDir("analyzer-git-sub-");
      try {
        execFileSync("git", ["init"], { cwd: rootDir, stdio: "ignore" });
        const subDir = join(rootDir, "packages", "core");
        await fs.mkdir(subDir, { recursive: true });

        const analyzer = new ProjectAnalyzer(subDir);
        const analysis = await analyzer.analyze();
        assert.equal(analysis.hasGit, true, "ProjectAnalyzer should report hasGit: true in a subdirectory");
      } finally {
        await removeDir(rootDir);
      }
    });
  });

  describe("tools execute with ctx.cwd", () => {
    it("uses ctx.cwd when params.projectRoot is omitted", async () => {
      const testDir = await createTempDir("readme-tool-ctx-");
      try {
        let registeredTool: any = null;
        const fakePi: any = {
          registerTool: (tool: any) => {
            registeredTool = tool;
          },
        };

        const state = createInitialState();
        registerReadmeGeneratorTools(fakePi, state);

        assert.ok(registeredTool, "Tool must be registered");

        // Call execute with action 'analyze' and ctx.cwd = testDir, without params.projectRoot
        const fakeCtx: any = {
          cwd: testDir,
        };

        const result = await registeredTool.execute("call-1", { action: "analyze" }, undefined, undefined, fakeCtx);
        assert.equal(result.isError, undefined);
        assert.ok(result.content[0].text.includes(`Project: ${testDir.split(/[\/\\]/).pop()}`));
      } finally {
        await removeDir(testDir);
      }
    });
  });
});
