/**
 * README content builder.
 */

import type { ProjectAnalysis } from "./types.js";
import { generateFrontmatter } from "./frontmatter.js";
import {
  statusColor,
  qualityColor,
  generateInstallation,
  generateUsage,
  generateFeatures,
  generateDevelopment,
  generateTesting,
  generateTreeStructure,
} from "./sections.js";

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
      lines.push("");
    }
    
    // Title and badges
    lines.push(`# ${name}`);
    lines.push("");
    
    const badges: string[] = [];
    badges.push(`![Language](https://img.shields.io/badge/Language-${encodeURIComponent(language)}-blue)`);
    if (framework) badges.push(`![Framework](https://img.shields.io/badge/Framework-${encodeURIComponent(framework)}-green)`);
    if (packageManager) badges.push(`![Package Manager](https://img.shields.io/badge/Package%20Manager-${encodeURIComponent(packageManager)}-orange)`);
    if (hasGit) badges.push("![Git](https://img.shields.io/badge/Version%20Control-Git-red)");
    if ((testFiles?.length ?? 0) > 0) badges.push("![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen)");
    if (this.analysis.suggestedStatus) {
      badges.push(`![Status](https://img.shields.io/badge/Status-${encodeURIComponent(this.analysis.suggestedStatus)}-${statusColor(this.analysis.suggestedStatus)})`);
    }
    if (this.analysis.suggestedQuality) {
      badges.push(`![Quality](https://img.shields.io/badge/Quality-${encodeURIComponent(this.analysis.suggestedQuality)}-${qualityColor(this.analysis.suggestedQuality)})`);
    }
    if (this.analysis.suggestedContext) {
      badges.push(`![Context](https://img.shields.io/badge/Context-${encodeURIComponent(this.analysis.suggestedContext)}-${this.analysis.suggestedContext === "work" ? "purple" : "blueviolet"})`);
    }
    
    if (badges.length > 0) {
      lines.push(badges.join(" "));
      lines.push("");
    }
    
    // Description
    lines.push(`> ${description}`);
    lines.push("");
    
    // Table of Contents
    lines.push("## Table of Contents");
    lines.push("");
    const toc = [
      "Installation",
      "Usage",
      "Features",
      "Project Structure",
      "Development",
      "Testing",
      "Configuration",
      "Contributing",
      "License",
    ];
    for (const item of toc) {
      lines.push(`- [${item}](#${item.toLowerCase().replace(/\s+/g, "-")})`);
    }
    lines.push("");
    
    // Installation
    lines.push("## Installation");
    lines.push("");
    lines.push(generateInstallation(packageManager));
    lines.push("");
    
    // Usage
    lines.push("## Usage");
    lines.push("");
    lines.push(generateUsage(scripts, entryPoints, language, packageManager));
    lines.push("");
    
    // Features
    lines.push("## Features");
    lines.push("");
    const features = generateFeatures(this.analysis);
    for (const feature of features) {
      lines.push(`- ${feature}`);
    }
    lines.push("");
    
    // Project Structure
    lines.push("## Project Structure");
    lines.push("");
    lines.push("```");
    lines.push(generateTreeStructure(this.analysis));
    lines.push("```");
    lines.push("");
    
    // Development
    lines.push("## Development");
    lines.push("");
    lines.push(generateDevelopment(scripts, configFiles ?? [], packageManager));
    lines.push("");
    
    // Testing
    lines.push("## Testing");
    lines.push("");
    lines.push(generateTesting(scripts, packageManager, testFiles));
    lines.push("");
    
    // Configuration
    if ((configFiles?.length ?? 0) > 0) {
      lines.push("## Configuration");
      lines.push("");
      lines.push("Key configuration files:");
      lines.push("");
      for (const config of (configFiles ?? []).slice(0, 10)) {
        lines.push(`- \`${config}\``);
      }
      lines.push("");
    }
    
    // Contributing
    lines.push("## Contributing");
    lines.push("");
    lines.push("Contributions are welcome! Please read our contributing guidelines before submitting PRs.");
    lines.push("");
    lines.push("1. Fork the repository");
    lines.push("2. Create a feature branch (`git checkout -b feature/amazing-feature`)");
    lines.push("3. Commit your changes (`git commit -m \"feat: add amazing feature\"`)");
    lines.push("4. Push to the branch (`git push origin feature/amazing-feature`)");
    lines.push("5. Open a Pull Request");
    lines.push("");
    
    // License
    lines.push("## License");
    lines.push("");
    lines.push("This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.");
    lines.push("");
    
    // Acknowledgments
    lines.push("## Acknowledgments");
    lines.push("");
    const acks = this.generateAcknowledgments();
    for (const ack of acks) {
      lines.push(`- ${ack}`);
    }
    lines.push("");
    
    // Footer
    lines.push("---");
    lines.push("");
    lines.push("*Generated with ❤️ by [pi-readme-generator](https://github.com/mastnacek/pi-readme-generator)*");
    
    return lines.join("\n");
  }

  private generateAcknowledgments(): string[] {
    const acks = [
      "Built with [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent)",
      "README generated by pi-readme-generator",
    ];
    
    if (this.analysis.framework) {
      acks.push(`Powered by ${this.analysis.framework}`);
    }
    
    return acks;
  }
}
