/**
 * README content builder.
 */

import type { ProjectAnalysis } from "./types.js";
import { generateFrontmatter } from "./frontmatter.js";

export class ReadmeBuilder {
  private analysis: ProjectAnalysis;

  constructor(analysis: ProjectAnalysis) {
    this.analysis = analysis;
  }

  build(): string {
    const { name, description, language, framework, packageManager, scripts, 
            entryPoints, testFiles, configFiles, hasGit } = this.analysis;
    
    const lines: string[] = [];
    
    // YAML frontmatter with project analysis data
    const frontmatter = generateFrontmatter(this.analysis);
    if (frontmatter) {
      lines.push(`---
${frontmatter}
---`);
      lines.push('');
    }
    
    // Title and badges
    lines.push(`# ${name}`);
    lines.push('');
    
    const badges: string[] = [];
    badges.push(`![Language](https://img.shields.io/badge/Language-${encodeURIComponent(language)}-blue)`);
    if (framework) badges.push(`![Framework](https://img.shields.io/badge/Framework-${encodeURIComponent(framework)}-green)`);
    if (packageManager) badges.push(`![Package Manager](https://img.shields.io/badge/Package%20Manager-${encodeURIComponent(packageManager)}-orange)`);
    if (hasGit) badges.push('![Git](https://img.shields.io/badge/Version%20Control-Git-red)');
    if ((testFiles?.length ?? 0) > 0) badges.push('![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen)');
    
    if (badges.length > 0) {
      lines.push(badges.join(' '));
      lines.push('');
    }
    
    // Description
    lines.push(`> ${description}`);
    lines.push('');
    
    // Table of Contents
    lines.push('## Table of Contents');
    lines.push('');
    const toc = [
      'Installation',
      'Usage',
      'Features',
      'Project Structure',
      'Development',
      'Testing',
      'Configuration',
      'Contributing',
      'License',
    ];
    for (const item of toc) {
      lines.push(`- [${item}](#${item.toLowerCase().replace(/\s+/g, '-')})`);
    }
    lines.push('');
    
    // Installation
    lines.push('## Installation');
    lines.push('');
    lines.push(this.generateInstallation(packageManager));
    lines.push('');
    
    // Usage
    lines.push('## Usage');
    lines.push('');
    lines.push(this.generateUsage(scripts, entryPoints, language, packageManager));
    lines.push('');
    
    // Features
    lines.push('## Features');
    lines.push('');
    const features = this.generateFeatures();
    for (const feature of features) {
      lines.push(`- ${feature}`);
    }
    lines.push('');
    
    // Project Structure
    lines.push('## Project Structure');
    lines.push('');
    lines.push('```');
    lines.push(this.generateTreeStructure());
    lines.push('```');
    lines.push('');
    
    // Development
    lines.push('## Development');
    lines.push('');
    lines.push(this.generateDevelopment(scripts, configFiles ?? [], packageManager));
    lines.push('');
    
    // Testing
    lines.push('## Testing');
    lines.push('');
    lines.push(this.generateTesting(scripts, packageManager, testFiles));
    lines.push('');
    
    // Configuration
    if ((configFiles?.length ?? 0) > 0) {
      lines.push('## Configuration');
      lines.push('');
      lines.push('Key configuration files:');
      lines.push('');
      for (const config of (configFiles ?? []).slice(0, 10)) {
        lines.push(`- \`${config}\``);
      }
      lines.push('');
    }
    
    // Contributing
    lines.push('## Contributing');
    lines.push('');
    lines.push('Contributions are welcome! Please read our contributing guidelines before submitting PRs.');
    lines.push('');
    lines.push('1. Fork the repository');
    lines.push('2. Create a feature branch (`git checkout -b feature/amazing-feature`)');
    lines.push('3. Commit your changes (`git commit -m "feat: add amazing feature"`)');
    lines.push('4. Push to the branch (`git push origin feature/amazing-feature`)');
    lines.push('5. Open a Pull Request');
    lines.push('');
    
    // License
    lines.push('## License');
    lines.push('');
    lines.push('This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.');
    lines.push('');
    
    // Acknowledgments
    lines.push('## Acknowledgments');
    lines.push('');
    const acks = this.generateAcknowledgments();
    for (const ack of acks) {
      lines.push(`- ${ack}`);
    }
    lines.push('');
    
    // Footer
    lines.push('---');
    lines.push('');
    lines.push('*Generated with ❤️ by [pi-readme-generator](https://github.com/mastnacek/pi-readme-generator)*');
    
    return lines.join('\n');
  }

  private generateInstallation(packageManager?: string): string {
    if (packageManager === 'npm' || packageManager === 'yarn' || packageManager === 'pnpm') {
      return '```bash\n# Install dependencies\n' + `${packageManager} install\n` + '```';
    } else if (packageManager === 'cargo') {
      return '```bash\n# Build the project\ncargo build\n```';
    } else if (packageManager === 'poetry') {
      return '```bash\n# Install dependencies\npoetry install\n```';
    } else if (packageManager === 'pipenv') {
      return '```bash\n# Install dependencies\npipenv install\n```';
    } else if (packageManager === 'go modules') {
      return '```bash\n# Download dependencies\ngo mod download\n```';
    } else {
      return '```bash\n# Install dependencies (adjust for your package manager)\n# npm install / yarn install / pnpm install\n```';
    }
  }

  private generateUsage(scripts: Record<string, string> | undefined, entryPoints: string[] | undefined, language: string, packageManager?: string): string {
    if (scripts && Object.keys(scripts).length > 0) {
      let output = 'Available scripts:\n\n```bash\n';
      for (const [name, cmd] of Object.entries(scripts)) {
        output += `# ${name}\n${packageManager || 'npm'} run ${name}  # ${cmd}\n\n`;
      }
      output += '```';
      return output;
    } else if (entryPoints && entryPoints.length > 0) {
      let output = 'Run the application:\n\n```bash\n';
      for (const entry of entryPoints) {
        const cmd = this.getRunCommand(entry, language, packageManager);
        output += `${cmd}\n`;
      }
      output += '```';
      return output;
    } else {
      return '```bash\n# Add usage instructions here\n```';
    }
  }

  private generateFeatures(): string[] {
    const { language, framework, dependencies, devDependencies, testFiles, configFiles } = this.analysis;
    const features: string[] = [];
    
    features.push(`Written in **${language}**${framework ? ` with **${framework}**` : ''}`);
    
    if (dependencies) {
      const depKeys = Object.keys(dependencies);
      if (depKeys.includes('react') || depKeys.includes('vue') || depKeys.includes('svelte') || depKeys.includes('solid-js')) {
        features.push('Modern frontend framework with component-based architecture');
      }
      if (depKeys.includes('express') || depKeys.includes('fastify') || depKeys.includes('koa') || depKeys.includes('hono')) {
        features.push('High-performance web server');
      }
      if (depKeys.includes('typescript')) {
        features.push('Full TypeScript support with strict type checking');
      }
      if (depKeys.includes('tailwindcss') || depKeys.includes('@tailwindcss')) {
        features.push('Utility-first CSS with Tailwind CSS');
      }
      if (depKeys.includes('zod') || depKeys.includes('valibot') || depKeys.includes('arktype')) {
        features.push('Runtime type validation and schema parsing');
      }
      if (depKeys.includes('prisma') || depKeys.includes('drizzle-orm') || depKeys.includes('typeorm') || depKeys.includes('kysely')) {
        features.push('Type-safe database ORM');
      }
    }
    
    if (devDependencies) {
      const devKeys = Object.keys(devDependencies);
      if (devKeys.includes('vitest') || devKeys.includes('jest') || devKeys.includes('@vitest')) {
        features.push('Fast unit testing with Vitest/Jest');
      }
      if (devKeys.includes('playwright') || devKeys.includes('@playwright')) {
        features.push('End-to-end testing with Playwright');
      }
      if (devKeys.includes('eslint') || devKeys.includes('@typescript-eslint')) {
        features.push('Code linting with ESLint');
      }
      if (devKeys.includes('prettier')) {
        features.push('Code formatting with Prettier');
      }
      if (devKeys.includes('husky') || devKeys.includes('lint-staged')) {
        features.push('Git hooks for code quality');
      }
      if (devKeys.includes('typescript') || devKeys.includes('tsx') || devKeys.includes('ts-node')) {
        features.push('TypeScript compilation and type checking');
      }
    }
    
    if ((testFiles?.length ?? 0) > 0) {
      features.push(`Comprehensive test suite (${testFiles?.length ?? 0} test files found)`);
    }
    
    if ((configFiles ?? []).some(f => f.includes('docker') || f.includes('Dockerfile'))) {
      features.push('Containerized deployment with Docker');
    }
    
    if ((configFiles ?? []).some(f => f.includes('github') || f.includes('.github'))) {
      features.push('GitHub Actions CI/CD pipeline');
    }
    
    if (features.length === 0) {
      features.push('Clean, maintainable codebase structure');
      features.push('Ready for development and extension');
    }
    
    return features.slice(0, 8);
  }

  private generateTreeStructure(): string {
    const { mainFiles, configFiles, testFiles, entryPoints } = this.analysis;
    const allFiles = [...new Set([...mainFiles, ...(configFiles ?? []), ...(testFiles ?? []), ...(entryPoints ?? [])])];
    
    const dirs = new Set<string>();
    for (const file of allFiles) {
      const parts = file.split('/');
      for (let i = 0; i < parts.length - 1; i++) {
        dirs.add(parts.slice(0, i + 1).join('/'));
      }
    }
    
    const sortedDirs = Array.from(dirs).sort();
    const lines: string[] = [];
    
    for (const dir of sortedDirs) {
      const depth = dir.split('/').length;
      const indent = '  '.repeat(depth);
      lines.push(`${indent}├── ${dir.split('/').pop()}/`);
    }
    
    for (const file of allFiles.slice(0, 20)) {
      const parts = file.split('/');
      const depth = parts.length - 1;
      const indent = '  '.repeat(depth);
      lines.push(`${indent}├── ${parts.pop()}`);
    }
    
    if (allFiles.length > 20) {
      lines.push(`  └── ... and ${allFiles.length - 20} more files`);
    }
    
    return lines.join('\n');
  }

  private generateDevelopment(scripts: Record<string, string> | undefined, configFiles: string[], packageManager?: string): string {
    let output = '';
    
    if (scripts?.dev || scripts?.start || scripts?.serve) {
      output += 'Start development server:\n\n```bash\n';
      const devScript = scripts.dev || scripts.start || scripts.serve;
      const scriptName = Object.keys(scripts).find(k => scripts[k] === devScript) || 'dev';
      output += `${packageManager || 'npm'} run ${scriptName}\n`;
      output += '```\n\n';
    }
    
    output += '### Code Style\n\n';
    if (configFiles.some(f => f.includes('eslint') || f.includes('prettier'))) {
      output += 'This project uses ESLint and Prettier for code formatting.\n\n';
      output += '```bash\n';
      output += '# Check formatting\n';
      output += `${packageManager || 'npm'} run lint\n\n`;
      output += '# Format code\n';
      output += `${packageManager || 'npm'} run format\n`;
      output += '```\n\n';
    } else if (configFiles.some(f => f.includes('rustfmt') || f.includes('clippy'))) {
      output += 'This project uses rustfmt and clippy for code formatting.\n\n';
      output += '```bash\n';
      output += '# Check formatting\n';
      output += 'cargo fmt --check\n';
      output += 'cargo clippy\n\n';
      output += '# Format code\n';
      output += 'cargo fmt\n';
      output += '```\n\n';
    }
    
    return output.trim();
  }

  private generateTesting(scripts: Record<string, string> | undefined, packageManager?: string, testFiles: string[] = []): string {
    if (scripts?.test) {
      return 'Run tests:\n\n```bash\n' + `${packageManager || 'npm'} run test\n` + '```';
    } else if (packageManager === 'cargo') {
      return 'Run tests:\n\n```bash\ncargo test\n```';
    } else if (testFiles.length > 0) {
      return 'Run tests:\n\n```bash\n# Add test command for your project\n```';
    } else {
      return 'No tests configured yet. Consider adding tests for your project.';
    }
  }

  private getRunCommand(entry: string, language: string, packageManager?: string): string {
    const pm = packageManager || 'npm';
    
    if (language === 'TypeScript' || language === 'JavaScript') {
      if (entry.endsWith('.ts')) return `${pm} run dev # or tsx ${entry}`;
      return `${pm} run dev # or node ${entry}`;
    }
    if (language === 'Python') return `python ${entry}`;
    if (language === 'Rust') return `cargo run`;
    if (language === 'Go') return `go run ${entry}`;
    if (language === 'Java') return `java ${entry.replace('.java', '')}`;
    if (language === 'C#') return `dotnet run`;
    return `# Run command for ${entry}`;
  }

  private generateAcknowledgments(): string[] {
    const acks = [
      'Built with [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent)',
      'README generated by pi-readme-generator',
    ];
    
    if (this.analysis.framework) {
      acks.push(`Powered by ${this.analysis.framework}`);
    }
    
    return acks;
  }
}