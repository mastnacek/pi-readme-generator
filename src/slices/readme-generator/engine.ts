/**
 * Main orchestrator for README generation workflow.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ProjectAnalyzer } from "./analyzer.js";
import { ReadmeBuilder } from "./readme-builder.js";
import { GitManager } from "./git-manager.js";
import type { ProjectAnalysis, ProgressStage, ProgressCallback, ReadmeGeneratorResult } from "./types.js";

export class ReadmeGeneratorEngine {
  private projectRoot: string;
  private onProgress: ProgressCallback;
  private pi: ExtensionAPI;
  private analysis: ProjectAnalysis | null = null;

  constructor(pi: ExtensionAPI, projectRoot: string, onProgress: ProgressCallback) {
    this.pi = pi;
    this.projectRoot = projectRoot;
    this.onProgress = onProgress;
  }

  async analyze(): Promise<ProjectAnalysis> {
    this.reportProgress({ stage: 'analyzing', message: 'Analyzing project structure...', progress: 10 });
    
    const analyzer = new ProjectAnalyzer(this.projectRoot);
    this.analysis = await analyzer.analyze();
    
    this.reportProgress({ 
      stage: 'analyzing', 
      message: `Project analyzed: ${this.analysis.name} (${this.analysis.language})`, 
      progress: 30,
      details: `Found ${this.analysis.mainFiles.length} main files, ${this.analysis.configFiles?.length ?? 0} config files`
    });
    
    return this.analysis;
  }

  async generateReadme(): Promise<string> {
    this.reportProgress({ stage: 'writing_readme', message: 'Generating README.md content...', progress: 40 });
    
    if (!this.analysis) {
      await this.analyze();
    }
    
    if (!this.analysis) throw new Error('Analysis failed');
    const builder = new ReadmeBuilder(this.analysis);
    const content = builder.build();
    
    this.reportProgress({ 
      stage: 'writing_readme', 
      message: 'Writing README.md to disk...', 
      progress: 60,
      details: `Generated ${content.split('\n').length} lines`
    });
    
    const { promises: fs } = await import("node:fs");
    const { join } = await import("node:path");
    const readmePath = join(this.projectRoot, 'README.md');
    await fs.writeFile(readmePath, content, 'utf-8');
    
    return content;
  }

  async initializeGit(): Promise<void> {
    const gitManager = new GitManager(this.projectRoot, this.onProgress);
    await gitManager.initialize();
  }

  async commitChanges(customMessage?: string): Promise<ReadmeGeneratorResult['commit']> {
    const gitManager = new GitManager(this.projectRoot, this.onProgress);
    return await gitManager.commit(customMessage);
  }

  async runFullWorkflow(customMessage?: string): Promise<ReadmeGeneratorResult> {
    const analysis = await this.analyze();
    const readme = await this.generateReadme();
    await this.initializeGit();
    const commit = await this.commitChanges(customMessage);
    
    this.reportProgress({ 
      stage: 'complete', 
      message: 'README generation workflow completed successfully!', 
      progress: 100 
    });
    
    return { analysis, readme, commit };
  }

  private reportProgress(stage: ProgressStage): void {
    this.onProgress(stage);
  }
}