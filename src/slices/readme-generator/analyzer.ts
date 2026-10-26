/**
 * Project analysis logic.
 */

import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, basename, relative, resolve } from "node:path";
import type { ProjectAnalysis } from "./types.js";

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
    const pkgPath = join(this.projectRoot, 'package.json');
    try {
      packageJson = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    } catch {
      // package.json not found or invalid, continue without it
    }
    
    let cargoToml: any = null;
    const cargoPath = join(this.projectRoot, 'Cargo.toml');
    try {
      const content = await fs.readFile(cargoPath, 'utf-8');
      cargoToml = this.parseCargoToml(content);
    } catch {
      // package.json not found or invalid, continue without it
    }
    
    let pyproject: any = null;
    const pyprojectPath = join(this.projectRoot, 'pyproject.toml');
    try {
      const content = await fs.readFile(pyprojectPath, 'utf-8');
      pyproject = this.parsePyprojectToml(content);
    } catch {
      // package.json not found or invalid, continue without it
    }
    
    const mainFiles = this.findMainFiles(relativeFiles, language);
    const configFiles = this.findConfigFiles(relativeFiles);
    const testFiles = this.findTestFiles(relativeFiles);
    const entryPoints = this.findEntryPoints(relativeFiles, language, packageJson);
    
    const hasGit = await this.checkGit();
    const hasReadme = relativeFiles.some(f => f.toLowerCase() === 'readme.md' || f.toLowerCase() === 'readme.txt');
    const category = await this.lookupRegistryCategory();
    
    const name = packageJson?.name || cargoToml?.package?.name || pyproject?.project?.name || basename(this.projectRoot);
    const description = packageJson?.description || cargoToml?.package?.description || pyproject?.project?.description || `A ${language} project`;
    
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
      'node_modules', '.git', 'dist', 'build', 'target', '.next', '.nuxt',
      'coverage', '.nyc_output', '__pycache__', '.pytest_cache', 'venv',
      '.venv', 'env', '.env', 'vendor', 'bower_components', '.idea',
      '.vscode', '.vs', 'out', 'bin', 'obj'
    ];
    return ignored.includes(name) || name.startsWith('.');
  }

  private shouldIgnoreFile(name: string): boolean {
    const ignored = ['.gitignore', '.gitattributes', '.eslintignore', '.prettierignore'];
    return ignored.includes(name) || name.endsWith('.log') || name.endsWith('.tmp');
  }

  private detectLanguage(files: string[]): string {
    const extensions = files.map(f => f.split('.').pop()?.toLowerCase()).filter(Boolean);
    const counts: Record<string, number> = {};
    
    for (const ext of extensions) {
      if (ext) counts[ext] = (counts[ext] || 0) + 1;
    }
    
    const langMap: Record<string, string> = {
      'ts': 'TypeScript', 'tsx': 'TypeScript', 'js': 'JavaScript', 'jsx': 'JavaScript',
      'py': 'Python', 'rs': 'Rust', 'go': 'Go', 'java': 'Java', 'kt': 'Kotlin',
      'cs': 'C#', 'cpp': 'C++', 'cc': 'C++', 'cxx': 'C++', 'hpp': 'C++',
      'rb': 'Ruby', 'php': 'PHP', 'swift': 'Swift', 'dart': 'Dart',
      'lua': 'Lua', 'r': 'R', 'scala': 'Scala', 'clj': 'Clojure',
      'hs': 'Haskell', 'ml': 'OCaml', 'fs': 'F#', 'ex': 'Elixir', 'exs': 'Elixir',
    };
    
    let maxCount = 0;
    let detectedLang = 'Unknown';
    
    for (const [ext, count] of Object.entries(counts)) {
      if (count > maxCount && langMap[ext]) {
        maxCount = count;
        detectedLang = langMap[ext];
      }
    }
    
    return detectedLang;
  }

  private detectFramework(files: string[], language: string): string | undefined {
    const fileNames = files.map(f => basename(f).toLowerCase());
    const hasFile = (name: string) => fileNames.includes(name);
    
    if (language === 'TypeScript' || language === 'JavaScript') {
      if (hasFile('next.config.js') || hasFile('next.config.ts')) return 'Next.js';
      if (hasFile('nuxt.config.ts') || hasFile('nuxt.config.js')) return 'Nuxt.js';
      if (hasFile('vite.config.ts') || hasFile('vite.config.js')) return 'Vite';
      if (hasFile('astro.config.mjs')) return 'Astro';
      if (hasFile('svelte.config.js')) return 'SvelteKit';
      if (hasFile('remix.config.js')) return 'Remix';
      if (hasFile('angular.json')) return 'Angular';
      if (hasFile('nest-cli.json')) return 'NestJS';
      if (hasFile('tauri.conf.json')) return 'Tauri';
      if (hasFile('electron-builder.json')) return 'Electron';
    }
    
    if (language === 'Python') {
      if (hasFile('manage.py')) return 'Django';
      if (hasFile('app.py') && files.some(f => f.includes('flask'))) return 'Flask';
      if (hasFile('fastapi.py') || (hasFile('main.py') && files.some(f => f.includes('fastapi')))) return 'FastAPI';
      if (hasFile('pyproject.toml') && files.some(f => f.includes('poetry'))) return 'Poetry';
    }
    
    if (language === 'Rust') {
      if (files.some(f => f.includes('tauri'))) return 'Tauri';
      if (files.some(f => f.includes('actix'))) return 'Actix Web';
      if (files.some(f => f.includes('rocket'))) return 'Rocket';
      if (files.some(f => f.includes('axum'))) return 'Axum';
    }
    
    if (language === 'Go') {
      if (files.some(f => f.includes('gin'))) return 'Gin';
      if (files.some(f => f.includes('echo'))) return 'Echo';
      if (files.some(f => f.includes('fiber'))) return 'Fiber';
    }
    
    return undefined;
  }

  private detectPackageManager(files: string[]): string | undefined {
    if (files.includes('pnpm-lock.yaml')) return 'pnpm';
    if (files.includes('yarn.lock')) return 'yarn';
    if (files.includes('package-lock.json')) return 'npm';
    if (files.includes('Cargo.lock')) return 'cargo';
    if (files.includes('poetry.lock')) return 'poetry';
    if (files.includes('Pipfile.lock')) return 'pipenv';
    if (files.includes('go.sum')) return 'go modules';
    return undefined;
  }

  private findMainFiles(files: string[], language: string): string[] {
    const patterns: Record<string, string[]> = {
      'TypeScript': ['src/index.ts', 'src/main.ts', 'src/app.ts', 'index.ts', 'main.ts'],
      'JavaScript': ['src/index.js', 'src/main.js', 'src/app.js', 'index.js', 'main.js'],
      'Python': ['src/main.py', 'main.py', 'app.py', 'run.py', '__main__.py'],
      'Rust': ['src/main.rs', 'src/lib.rs', 'main.rs', 'lib.rs'],
      'Go': ['main.go', 'cmd/main.go'],
      'Java': ['src/main/java/Main.java', 'src/main/java/App.java'],
      'C#': ['Program.cs', 'src/Program.cs'],
      'Ruby': ['main.rb', 'app.rb'],
      'PHP': ['index.php', 'public/index.php'],
    };
    
    const langPatterns = patterns[language] || [];
    return langPatterns.filter(p => files.includes(p));
  }

  private findConfigFiles(files: string[]): string[] {
    const configPatterns = [
      'package.json', 'tsconfig.json', 'tsconfig.base.json', 'vite.config.ts',
      'webpack.config.js', 'rollup.config.js', 'esbuild.config.js',
      'Cargo.toml', 'Cargo.lock', 'pyproject.toml', 'requirements.txt',
      'setup.py', 'setup.cfg', 'Pipfile', 'go.mod', 'go.sum',
      'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle',
      'composer.json', 'Gemfile', 'Gemfile.lock', 'mix.exs',
      'pubspec.yaml', 'CMakeLists.txt', 'Makefile', 'meson.build',
      '.eslintrc.js', '.eslintrc.json', '.prettierrc', '.prettierrc.json',
      'jest.config.js', 'vitest.config.ts', 'playwright.config.ts',
      'tailwind.config.js', 'postcss.config.js',
    ];
    
    return configPatterns.filter(p => files.includes(p));
  }

  private findTestFiles(files: string[]): string[] {
    return files.filter(f => 
      f.includes('test') || f.includes('spec') || f.includes('__tests__') ||
      f.endsWith('.test.ts') || f.endsWith('.test.js') || f.endsWith('.spec.ts') || f.endsWith('.spec.js') ||
      f.endsWith('_test.py') || f.endsWith('_test.rs') || f.endsWith('_test.go')
    ).slice(0, 10);
  }

  private findEntryPoints(files: string[], language: string, packageJson: any): string[] {
    const entries: string[] = [];
    
    if (packageJson?.main) entries.push(packageJson.main);
    if (packageJson?.module) entries.push(packageJson.module);
    if (packageJson?.exports) {
      if (typeof packageJson.exports === 'string') entries.push(packageJson.exports);
      else if (typeof packageJson.exports === 'object') {
        for (const [_key, value] of Object.entries(packageJson.exports)) {
          if (typeof value === 'string') entries.push(value);
          else if (typeof value === 'object' && value && 'import' in value) entries.push((value as any).import);
        }
      }
    }
    
    const defaults: Record<string, string[]> = {
      'TypeScript': ['src/index.ts', 'index.ts'],
      'JavaScript': ['src/index.js', 'index.js'],
      'Python': ['src/__main__.py', 'main.py'],
      'Rust': ['src/lib.rs', 'src/main.rs'],
      'Go': ['main.go'],
    };
    
    for (const def of defaults[language] || []) {
      if (files.includes(def) && !entries.includes(def)) entries.push(def);
    }
    
    return entries.slice(0, 5);
  }

  private async checkGit(): Promise<boolean> {
    try {
      await fs.access(join(this.projectRoot, '.git'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Look up this project's category in the persistent project registry
   * (~/.pi/projects.json, maintained by the pi-project-registry skill).
   * Matches by stable project ID (same algorithm as the registry: SHA256 of
   * repo name + origin URL + git config head) or, as a fallback, by the
   * tracked paths array. Returns undefined when not registered.
   */
  private async lookupRegistryCategory(): Promise<string | undefined> {
    let registry: any;
    try {
      registry = JSON.parse(await fs.readFile(join(homedir(), '.pi', 'projects.json'), 'utf-8'));
    } catch {
      return undefined;
    }

    const projects: any[] = Array.isArray(registry?.projects) ? registry.projects : [];
    if (projects.length === 0) return undefined;

    const id = await this.computeRegistryId();
    if (id) {
      const byId = projects.find(p => p?.id === id);
      if (byId?.category) return byId.category;
    }

    const normalizedRoot = this.normalizeRegistryPath(this.projectRoot);
    const byPath = projects.find(p =>
      Array.isArray(p?.paths) &&
      p.paths.some((p2: unknown) => typeof p2 === 'string' && this.normalizeRegistryPath(p2) === normalizedRoot)
    );
    return byPath?.category ?? undefined;
  }

  private normalizeRegistryPath(p: string): string {
    return resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }

  /** Replicates _compute_project_id() from the pi-project-registry skill. */
  private async computeRegistryId(): Promise<string | undefined> {
    const parts = [basename(this.projectRoot)];
    try {
      const configText = await fs.readFile(join(this.projectRoot, '.git', 'config'), 'utf-8');
      const originMatch = /\[remote "origin"\]\s+url = (.+)/.exec(configText);
      if (originMatch) parts.push(originMatch[1].trim());
      parts.push(configText.slice(0, 500));
    } catch {
      // no .git/config — ID is based on repo name only
    }
    return 'sha256:' + createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
  }

  private parseCargoToml(content: string): any {
    const result: any = { package: {} };
    let currentSection = '';
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        if (!result[currentSection]) result[currentSection] = {};
      } else if (trimmed.includes('=') && !trimmed.startsWith('#')) {
        const [key, value] = trimmed.split('=').map(s => s.trim().replace(/^"|"$/g, ''));
        if (currentSection === 'package') {
          result.package[key] = value;
        } else {
          result[currentSection] = result[currentSection] || {};
          result[currentSection][key] = value;
        }
      }
    }
    return result;
  }

  private parsePyprojectToml(content: string): any {
    const result: any = { project: {} };
    let currentSection = '';
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        if (!result[currentSection]) result[currentSection] = {};
      } else if (trimmed.includes('=') && !trimmed.startsWith('#')) {
        const [key, value] = trimmed.split('=').map(s => s.trim().replace(/^"|"$/g, ''));
        if (currentSection === 'project') {
          result.project[key] = value;
        } else if (currentSection.startsWith('tool.')) {
          result[currentSection] = result[currentSection] || {};
          result[currentSection][key] = value;
        }
      }
    }
    return result;
  }
}