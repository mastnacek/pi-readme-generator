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
}

export interface ProgressStage {
  stage: 'analyzing' | 'writing_readme' | 'git_init' | 'git_commit' | 'complete' | 'error';
  message: string;
  progress: number;
  details?: string;
}

export type ProgressCallback = (stage: ProgressStage) => void;

export interface GitCommitInfo {
  isFirstCommit: boolean;
  files: string[];
  message: string;
  emoji: string;
}

export interface ReadmeGeneratorResult {
  analysis: ProjectAnalysis;
  readme: string;
  commit: GitCommitInfo;
}