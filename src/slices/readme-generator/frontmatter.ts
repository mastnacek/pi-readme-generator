/**
 * YAML frontmatter generator for README files.
 */

import type { ProjectAnalysis } from "./types.js";

export function generateFrontmatter(analysis: ProjectAnalysis): string {
  const { name, description, language, framework, packageManager, scripts,
          entryPoints, testFiles, configFiles, hasGit, hasReadme,
          dependencies, devDependencies, mainFiles, category } = analysis;

  const lines: string[] = [];

  // Core project metadata
  lines.push(`project:`);
  lines.push(`  name: "${name}"`);
  lines.push(`  description: "${description.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`);
  lines.push(`  language: "${language}"`);
  if (category) lines.push(`  category: "${category}"`);
  if (framework) lines.push(`  framework: "${framework}"`);
  if (packageManager) lines.push(`  packageManager: "${packageManager}"`);

  // Source analysis
  lines.push(`analysis:`);
  lines.push(`  hasGit: ${hasGit}`);
  lines.push(`  hasReadme: ${hasReadme}`);
  lines.push(`  mainFiles: ${JSON.stringify(mainFiles)}`);
  if (entryPoints && entryPoints.length > 0) {
    lines.push(`  entryPoints: ${JSON.stringify(entryPoints)}`);
  }
  if (configFiles && configFiles.length > 0) {
    lines.push(`  configFiles: ${JSON.stringify(configFiles.slice(0, 20))}`);
  }
  if (testFiles && testFiles.length > 0) {
    lines.push(`  testFiles: ${JSON.stringify(testFiles.slice(0, 20))}`);
    lines.push(`  testFileCount: ${testFiles.length}`);
  }

  // Dependencies (only names, not versions, for brevity)
  if (dependencies && Object.keys(dependencies).length > 0) {
    lines.push(`  dependencies: ${JSON.stringify(Object.keys(dependencies))}`);
  }
  if (devDependencies && Object.keys(devDependencies).length > 0) {
    lines.push(`  devDependencies: ${JSON.stringify(Object.keys(devDependencies))}`);
  }

  // Available scripts
  if (scripts && Object.keys(scripts).length > 0) {
    lines.push(`  scripts: ${JSON.stringify(scripts)}`);
  }

  // Generation metadata
  lines.push(`generator:`);
  lines.push(`  tool: "pi-readme-generator"`);
  lines.push(`  version: "0.2.1"`);
  lines.push(`  timestamp: "${new Date().toISOString()}"`);

  return lines.join('\n');
}