/**
 * Git operations manager.
 */

import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { join, basename } from "node:path";
import type { GitCommitInfo, ProgressCallback, ProgressStage } from "./types.js";

export class GitManager {
  private projectRoot: string;
  private onProgress: ProgressCallback;

  constructor(projectRoot: string, onProgress: ProgressCallback) {
    this.projectRoot = projectRoot;
    this.onProgress = onProgress;
  }

  private reportProgress(stage: ProgressStage): void {
    this.onProgress(stage);
  }

  async initialize(): Promise<void> {
    this.reportProgress({ stage: 'git_init', message: 'Initializing Git repository...', progress: 70 });
    
    const hasGit = await this.checkGit();
    if (!hasGit) {
      try {
        execSync('git init', { cwd: this.projectRoot, stdio: 'ignore' });
        this.reportProgress({ 
          stage: 'git_init', 
          message: 'Git repository initialized', 
          progress: 75 
        });
      } catch (error) {
        throw new Error(`Failed to initialize git: ${error}`);
      }
    } else {
      this.reportProgress({ 
        stage: 'git_init', 
        message: 'Git repository already exists', 
        progress: 75 
      });
    }
    
    // Configure git if needed
    try {
      execSync('git config user.name "pi-readme-generator"', { cwd: this.projectRoot, stdio: 'ignore' });
      execSync('git config user.email "pi-readme-generator@local"', { cwd: this.projectRoot, stdio: 'ignore' });
    } catch {
      // git config failed, continue without it
    }
  }

  async commit(customMessage?: string): Promise<GitCommitInfo> {
    this.reportProgress({ stage: 'git_commit', message: 'Staging files for commit...', progress: 80 });
    
    try {
      // Add all files
      execSync('git add -A', { cwd: this.projectRoot, stdio: 'ignore' });
      
      // Check if there are changes to commit
      const statusOutput = execSync('git status --porcelain', { cwd: this.projectRoot, encoding: 'utf-8' });
      const files = statusOutput.trim().split('\n').filter(Boolean).map(line => line.slice(3));
      
      if (files.length === 0) {
        this.reportProgress({ 
          stage: 'git_commit', 
          message: 'No changes to commit', 
          progress: 100 
        });
        return {
          isFirstCommit: false,
          files: [],
          message: 'No changes',
          emoji: '✅',
        };
      }
      
      const isFirstCommit = !(await this.checkGitHistory());
      const commitMessage = customMessage || this.generateCommitMessage(isFirstCommit, files);
      const emoji = this.getCommitEmoji(isFirstCommit, files);
      
      this.reportProgress({ 
        stage: 'git_commit', 
        message: `Committing: ${emoji} ${commitMessage.split('\n')[0]}`, 
        progress: 90,
        details: `${files.length} files staged`
      });
      
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { 
        cwd: this.projectRoot, 
        stdio: 'ignore' 
      });
      
      this.reportProgress({ 
        stage: 'complete', 
        message: `Commit successful: ${emoji} ${commitMessage.split('\n')[0]}`, 
        progress: 100 
      });
      
      return {
        isFirstCommit,
        files,
        message: commitMessage,
        emoji,
      };
    } catch (error) {
      this.reportProgress({ 
        stage: 'error', 
        message: `Commit failed: ${error}`, 
        progress: 0 
      });
      throw error;
    }
  }

  private async checkGit(): Promise<boolean> {
    try {
      await fs.access(join(this.projectRoot, '.git'));
      return true;
    } catch {
      return false;
    }
  }

  private async checkGitHistory(): Promise<boolean> {
    try {
      execSync('git rev-parse --verify HEAD', { cwd: this.projectRoot, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private generateCommitMessage(isFirstCommit: boolean, files: string[]): string {
    if (isFirstCommit) {
      const fileList = files.slice(0, 10).join(', ') + (files.length > 10 ? ` and ${files.length - 10} more` : '');
      return `🎉 Initial commit: Add project files\n\nFiles: ${fileList}`;
    }
    
    // Determine commit type based on files
    const hasReadme = files.some(f => f.toLowerCase().includes('readme'));
    const hasConfig = files.some(f => ['package.json', 'tsconfig.json', 'Cargo.toml', 'pyproject.toml'].includes(basename(f)));
    const hasSource = files.some(f => f.startsWith('src/') || f.startsWith('lib/') || f.startsWith('app/'));
    const hasTest = files.some(f => f.includes('test') || f.includes('spec'));
    const hasDocs = files.some(f => f.includes('doc') || f.endsWith('.md'));
    
    let type = 'chore';
    let scope = '';
    
    if (hasReadme) {
      type = 'docs';
      scope = 'readme';
    } else if (hasConfig) {
      type = 'config';
    } else if (hasSource) {
      type = 'feat';
      scope = 'src';
    } else if (hasTest) {
      type = 'test';
    } else if (hasDocs) {
      type = 'docs';
    }
    
    const scopeStr = scope ? `(${scope})` : '';
    const shortFiles = files.slice(0, 5).join(', ') + (files.length > 5 ? ` +${files.length - 5} more` : '');
    
    return `${type}${scopeStr}: ${this.getCommitDescription(type, files)}\n\nFiles: ${shortFiles}`;
  }

  private getCommitDescription(type: string, _files: string[]): string {
    const descriptions: Record<string, string> = {
      'docs': 'Update documentation',
      'feat': 'Add new functionality',
      'fix': 'Fix bug',
      'config': 'Update configuration',
      'test': 'Add or update tests',
      'chore': 'Maintenance tasks',
      'refactor': 'Refactor code',
      'style': 'Code style improvements',
      'perf': 'Performance improvements',
    };
    
    return descriptions[type] || 'Update project';
  }

  private getCommitEmoji(isFirstCommit: boolean, files: string[]): string {
    if (isFirstCommit) return '🎉';
    
    const hasReadme = files.some(f => f.toLowerCase().includes('readme'));
    const hasConfig = files.some(f => ['package.json', 'tsconfig.json', 'Cargo.toml', 'pyproject.toml'].includes(basename(f)));
    const hasSource = files.some(f => f.startsWith('src/') || f.startsWith('lib/') || f.startsWith('app/'));
    const hasTest = files.some(f => f.includes('test') || f.includes('spec'));
    const hasDocs = files.some(f => f.includes('doc') || f.endsWith('.md'));
    
    if (hasReadme) return '📝';
    if (hasConfig) return '⚙️';
    if (hasSource) return '✨';
    if (hasTest) return '🧪';
    if (hasDocs) return '📚';
    return '🔧';
  }
}