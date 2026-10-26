/**
 * Core types for README generation and git management.
 */

export interface ProjectAnalysis {
  name: string;
  description: string;
  language: string;
  framework?: string;
  mainFiles: string[];
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  entryPoints?: string[];
  testFiles?: string[];
  configFiles?: string[];
  hasGit: boolean;
  hasReadme: boolean;
  /** Category from the persistent project registry (~/.pi/projects.json), if registered. */
  category?: string;
}

export interface GitCommitInfo {
  isFirstCommit: boolean;
  files: string[];
  message: string;
}

/** Actions supported by the readme_generator tool. */
export type ReadmeAction = "analyze" | "scaffold" | "frontmatter" | "commit" | "init-git";
