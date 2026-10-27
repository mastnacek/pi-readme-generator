/**
 * Project analysis logic.
 */

import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { basename, join, relative } from "node:path";
import type { ProjectAnalysis } from "./types.js";
import {
  checkCI,
  checkLicense,
  checkTypes,
  getGitDetails,
  evaluateContext,
  evaluateStatus,
  evaluateQuality,
  evaluateProgress,
} from "./evaluator.js";
import {
  parseCargoToml,
  parsePyprojectToml,
  lookupRegistryCategory,
  CONFIG_PATTERNS,
  LANGUAGE_MAP,
} from "./parsers.js";

export class ProjectAnalyzer {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async analyze(): Promise<ProjectAnalysis> {
    const files = await this.getAllFiles(this.projectRoot);
    const relativeFiles = files.map(f => relative(this.projectRoot, f));

    const language = this.detectLanguage(relativeFiles);
    const framework = this.detectFramework(relativeFiles, language);
    const packageManager = this.detectPackageManager(relativeFiles);

    let packageJson: any = null;
    const pkgPath = join(this.projectRoot, "package.json");
    try {
      packageJson = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    } catch {
      // package.json not found or invalid
    }

    let cargoToml: any = null;
    const cargoPath = join(this.projectRoot, "Cargo.toml");
    try {
      const content = await fs.readFile(cargoPath, "utf-8");
      cargoToml = parseCargoToml(content);
    } catch {
      // Cargo.toml not found or invalid
    }

    let pyproject: any = null;
    const pyprojectPath = join(this.projectRoot, "pyproject.toml");
    try {
      const content = await fs.readFile(pyprojectPath, "utf-8");
      pyproject = parsePyprojectToml(content);
    } catch {
      // pyproject.toml not found or invalid
    }

    const mainFiles = this.findMainFiles(relativeFiles, language);
    const configFiles = this.findConfigFiles(relativeFiles);
    const testFiles = this.findTestFiles(relativeFiles);
    const entryPoints = this.findEntryPoints(relativeFiles, language, packageJson);

    const hasGit = await this.checkGit();
    const hasReadme = relativeFiles.some(f => f.toLowerCase() === "readme.md" || f.toLowerCase() === "readme.txt");
    const category = await lookupRegistryCategory(this.projectRoot);

    const name = packageJson?.name || cargoToml?.package?.name || pyproject?.project?.name || basename(this.projectRoot);
    const description = packageJson?.description || cargoToml?.package?.description || pyproject?.project?.description || `A ${language} project`;
    const version = packageJson?.version || cargoToml?.package?.version || pyproject?.project?.version;

    const hasCI = await checkCI(this.projectRoot, relativeFiles);
    const hasLicense = await checkLicense(this.projectRoot, relativeFiles);
    const hasTypes = checkTypes(relativeFiles, language);
    const gitDetails = hasGit ? getGitDetails(this.projectRoot) : { commitCount: 0, lastCommit: "", remoteUrl: "" };

    const allDeps: Record<string, string> = {
      ...(packageJson?.dependencies ?? {}),
      ...(cargoToml?.dependencies ?? {}),
    };

    const suggestedContext = evaluateContext(this.projectRoot, relativeFiles, language, allDeps, gitDetails.remoteUrl);
    const suggestedStatus = evaluateStatus(gitDetails.commitCount, testFiles.length > 0, version);
    const suggestedQuality = evaluateQuality(testFiles.length, hasCI, hasTypes, hasLicense, hasReadme, gitDetails.commitCount);
    const suggestedProgress = evaluateProgress(gitDetails.commitCount, suggestedStatus, suggestedQuality);

    return {
      name,
      description,
      language,
      framework,
      mainFiles,
      packageManager,
      scripts: packageJson?.scripts,
      dependencies: packageJson?.dependencies,
      devDependencies: packageJson?.devDependencies,
      entryPoints,
      testFiles,
      configFiles,
      hasGit,
      hasReadme,
      category,
      hasCI,
      hasLicense,
      hasTypes,
      gitCommitCount: gitDetails.commitCount,
      gitLastCommit: gitDetails.lastCommit,
      suggestedStatus,
      suggestedQuality,
      suggestedContext,
      suggestedProgress,
    };
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!this.shouldIgnoreDir(entry.name)) {
          files.push(...await this.getAllFiles(fullPath));
        }
      } else if (entry.isFile()) {
        if (!this.shouldIgnoreFile(entry.name)) {
          files.push(fullPath);
        }
      }
    }
    return files;
  }

  private shouldIgnoreDir(name: string): boolean {
    const ignored = [
      "node_modules", ".git", "dist", "build", "target", ".next", ".nuxt",
      "coverage", ".nyc_output", "__pycache__", ".pytest_cache", "venv",
      ".venv", "env", ".env", "vendor", "bower_components", ".idea",
      ".vscode", ".vs", "out", "bin", "obj",
    ];
    return ignored.includes(name) || name.startsWith(".");
  }

  private shouldIgnoreFile(name: string): boolean {
    const ignored = [".gitignore", ".gitattributes", ".eslintignore", ".prettierignore"];
    return ignored.includes(name) || name.endsWith(".log") || name.endsWith(".tmp");
  }

  private detectLanguage(files: string[]): string {
    const extensions = files.map(f => f.split(".").pop()?.toLowerCase()).filter(Boolean);
    const counts: Record<string, number> = {};

    for (const ext of extensions) {
      if (ext) counts[ext] = (counts[ext] || 0) + 1;
    }

    let maxCount = 0;
    let detectedLang = "Unknown";

    for (const [ext, count] of Object.entries(counts)) {
      if (count > maxCount && LANGUAGE_MAP[ext]) {
        maxCount = count;
        detectedLang = LANGUAGE_MAP[ext];
      }
    }

    return detectedLang;
  }

  private detectFramework(files: string[], language: string): string | undefined {
    const fileNames = files.map(f => basename(f).toLowerCase());
    const hasFile = (name: string) => fileNames.includes(name);

    if (language === "TypeScript" || language === "JavaScript") {
      if (hasFile("next.config.js") || hasFile("next.config.ts")) return "Next.js";
      if (hasFile("nuxt.config.ts") || hasFile("nuxt.config.js")) return "Nuxt.js";
      if (hasFile("vite.config.ts") || hasFile("vite.config.js")) return "Vite";
      if (hasFile("astro.config.mjs")) return "Astro";
      if (hasFile("svelte.config.js")) return "SvelteKit";
      if (hasFile("remix.config.js")) return "Remix";
      if (hasFile("angular.json")) return "Angular";
      if (hasFile("nest-cli.json")) return "NestJS";
      if (hasFile("tauri.conf.json")) return "Tauri";
      if (hasFile("electron-builder.json")) return "Electron";
    }

    if (language === "Python") {
      if (hasFile("manage.py")) return "Django";
      if (hasFile("app.py") && files.some(f => f.includes("flask"))) return "Flask";
      if (hasFile("fastapi.py") || (hasFile("main.py") && files.some(f => f.includes("fastapi")))) return "FastAPI";
      if (hasFile("pyproject.toml") && files.some(f => f.includes("poetry"))) return "Poetry";
    }

    if (language === "Rust") {
      if (files.some(f => f.includes("tauri"))) return "Tauri";
      if (files.some(f => f.includes("actix"))) return "Actix Web";
      if (files.some(f => f.includes("rocket"))) return "Rocket";
      if (files.some(f => f.includes("axum"))) return "Axum";
    }

    if (language === "Go") {
      if (files.some(f => f.includes("gin"))) return "Gin";
      if (files.some(f => f.includes("echo"))) return "Echo";
      if (files.some(f => f.includes("fiber"))) return "Fiber";
    }

    return undefined;
  }

  private detectPackageManager(files: string[]): string | undefined {
    if (files.includes("pnpm-lock.yaml")) return "pnpm";
    if (files.includes("yarn.lock")) return "yarn";
    if (files.includes("package-lock.json")) return "npm";
    if (files.includes("Cargo.lock")) return "cargo";
    if (files.includes("poetry.lock")) return "poetry";
    if (files.includes("Pipfile.lock")) return "pipenv";
    if (files.includes("go.sum")) return "go modules";
    return undefined;
  }

  private findMainFiles(files: string[], language: string): string[] {
    const patterns: Record<string, string[]> = {
      "TypeScript": ["src/index.ts", "src/main.ts", "src/app.ts", "index.ts", "main.ts"],
      "JavaScript": ["src/index.js", "src/main.js", "src/app.js", "index.js", "main.js"],
      "Python": ["src/main.py", "main.py", "app.py", "run.py", "__main__.py"],
      "Rust": ["src/main.rs", "src/lib.rs", "main.rs", "lib.rs"],
      "Go": ["main.go", "cmd/main.go"],
      "Java": ["src/main/java/Main.java", "src/main/java/App.java"],
      "C#": ["Program.cs", "src/Program.cs"],
      "Ruby": ["main.rb", "app.rb"],
      "PHP": ["index.php", "public/index.php"],
    };

    const langPatterns = patterns[language] || [];
    return langPatterns.filter(p => files.includes(p));
  }

  private findConfigFiles(files: string[]): string[] {
    return CONFIG_PATTERNS.filter(p => files.includes(p));
  }

  private findTestFiles(files: string[]): string[] {
    return files.filter(f =>
      f.includes("test") || f.includes("spec") || f.includes("__tests__") ||
      f.endsWith(".test.ts") || f.endsWith(".test.js") || f.endsWith(".spec.ts") || f.endsWith(".spec.js") ||
      f.endsWith("_test.py") || f.endsWith("_test.rs") || f.endsWith("_test.go")
    ).slice(0, 10);
  }

  private findEntryPoints(files: string[], language: string, packageJson: any): string[] {
    const entries: string[] = [];

    if (packageJson?.main) entries.push(packageJson.main);
    if (packageJson?.module) entries.push(packageJson.module);
    if (packageJson?.exports) {
      if (typeof packageJson.exports === "string") entries.push(packageJson.exports);
      else if (typeof packageJson.exports === "object") {
        for (const [_key, value] of Object.entries(packageJson.exports)) {
          if (typeof value === "string") entries.push(value);
          else if (typeof value === "object" && value && "import" in value) entries.push((value as any).import);
        }
      }
    }

    const defaults: Record<string, string[]> = {
      "TypeScript": ["src/index.ts", "index.ts"],
      "JavaScript": ["src/index.js", "index.js"],
      "Python": ["src/__main__.py", "main.py"],
      "Rust": ["src/lib.rs", "src/main.rs"],
      "Go": ["main.go"],
    };

    for (const def of defaults[language] || []) {
      if (files.includes(def) && !entries.includes(def)) entries.push(def);
    }

    return entries.slice(0, 5);
  }

  private async checkGit(): Promise<boolean> {
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
}
