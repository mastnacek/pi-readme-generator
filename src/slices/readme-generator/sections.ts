/**
 * Section generation helpers for ReadmeBuilder.
 */

import { basename } from "node:path";
import type { ProjectAnalysis } from "./types.js";

export function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "production": return "brightgreen";
    case "active": return "green";
    case "in-development": return "blue";
    case "prototype": return "orange";
    case "concept": return "lightgrey";
    case "maintenance": return "yellow";
    case "archived": return "red";
    default: return "blue";
  }
}

export function qualityColor(quality: string): string {
  switch (quality.toLowerCase()) {
    case "mature": return "brightgreen";
    case "stable": return "green";
    case "beta": return "blue";
    case "alpha": return "orange";
    case "experimental": return "red";
    default: return "blue";
  }
}

export function generateInstallation(packageManager?: string): string {
  if (packageManager === "npm" || packageManager === "yarn" || packageManager === "pnpm") {
    return "```bash\n# Install dependencies\n" + `${packageManager} install\n` + "```";
  } else if (packageManager === "cargo") {
    return "```bash\n# Build the project\ncargo build\n```";
  } else if (packageManager === "poetry") {
    return "```bash\n# Install dependencies\npoetry install\n```";
  } else if (packageManager === "pipenv") {
    return "```bash\n# Install dependencies\npipenv install\n```";
  } else if (packageManager === "go modules") {
    return "```bash\n# Download dependencies\ngo mod download\n```";
  } else {
    return "```bash\n# Install dependencies (adjust for your package manager)\n# npm install / yarn install / pnpm install\n```";
  }
}

export function getRunCommand(entry: string, language: string, packageManager?: string): string {
  const pm = packageManager || "npm";

  if (language === "TypeScript" || language === "JavaScript") {
    if (entry.endsWith(".ts")) return `${pm} run dev # or tsx ${entry}`;
    return `${pm} run dev # or node ${entry}`;
  }
  if (language === "Python") return `python ${entry}`;
  if (language === "Rust") return `cargo run`;
  if (language === "Go") return `go run ${entry}`;
  if (language === "Java") return `java ${entry.replace(".java", "")}`;
  if (language === "C#") return `dotnet run`;
  return `# Run command for ${entry}`;
}

export function generateUsage(
  scripts: Record<string, string> | undefined,
  entryPoints: string[] | undefined,
  language: string,
  packageManager?: string,
): string {
  if (scripts && Object.keys(scripts).length > 0) {
    let output = "Available scripts:\n\n```bash\n";
    for (const [name, cmd] of Object.entries(scripts)) {
      output += `# ${name}\n${packageManager || "npm"} run ${name}  # ${cmd}\n\n`;
    }
    output += "```";
    return output;
  } else if (entryPoints && entryPoints.length > 0) {
    let output = "Run the application:\n\n```bash\n";
    for (const entry of entryPoints) {
      const cmd = getRunCommand(entry, language, packageManager);
      output += `${cmd}\n`;
    }
    output += "```";
    return output;
  } else {
    return "```bash\n# Add usage instructions here\n```";
  }
}

export function generateFeatures(analysis: ProjectAnalysis): string[] {
  const { language, framework, dependencies, devDependencies } = analysis;
  const features: string[] = [];

  features.push(`Written in **${language}**${framework ? ` with **${framework}**` : ""}`);

  if (dependencies) {
    const depKeys = Object.keys(dependencies);
    if (depKeys.includes("react") || depKeys.includes("vue") || depKeys.includes("svelte") || depKeys.includes("solid-js")) {
      features.push("Modern frontend framework with component-based architecture");
    }
    if (depKeys.includes("express") || depKeys.includes("fastify") || depKeys.includes("koa") || depKeys.includes("hono")) {
      features.push("High-performance web server");
    }
    if (depKeys.includes("typescript")) {
      features.push("Full TypeScript support with strict type checking");
    }
    if (depKeys.includes("tailwindcss") || depKeys.includes("@tailwindcss")) {
      features.push("Utility-first CSS with Tailwind CSS");
    }
    if (depKeys.includes("zod") || depKeys.includes("valibot") || depKeys.includes("arktype")) {
      features.push("Runtime type validation and schema parsing");
    }
    if (depKeys.includes("prisma") || depKeys.includes("drizzle-orm") || depKeys.includes("typeorm") || depKeys.includes("kysely")) {
      features.push("Type-safe database ORM");
    }
  }

  if (devDependencies) {
    const devKeys = Object.keys(devDependencies);
    if (devKeys.includes("vitest") || devKeys.includes("jest") || devKeys.includes("@vitest")) {
      features.push("Fast unit testing with Vitest/Jest");
    }
    if (devKeys.includes("playwright") || devKeys.includes("@playwright")) {
      features.push("End-to-end testing with Playwright");
    }
    if (devKeys.includes("eslint") || devKeys.includes("@typescript-eslint")) {
      features.push("Code linting with ESLint");
    }
  }

  return features;
}

export function generateDevelopment(
  scripts: Record<string, string> | undefined,
  configFiles: string[],
  packageManager?: string,
): string {
  let output = "";

  if (scripts?.dev || scripts?.start || scripts?.serve) {
    output += "Start development server:\n\n```bash\n";
    const devScript = scripts.dev || scripts.start || scripts.serve;
    const scriptName = Object.keys(scripts).find(k => scripts[k] === devScript) || "dev";
    output += `${packageManager || "npm"} run ${scriptName}\n`;
    output += "```\n\n";
  }

  output += "### Code Style\n\n";
  if (configFiles.some(f => f.includes("eslint") || f.includes("prettier"))) {
    output += "This project uses ESLint and Prettier for code formatting.\n\n";
    output += "```bash\n";
    output += "# Check formatting\n";
    output += `${packageManager || "npm"} run lint\n\n`;
    output += "# Format code\n";
    output += `${packageManager || "npm"} run format\n`;
    output += "```\n\n";
  } else if (configFiles.some(f => f.includes("rustfmt") || f.includes("clippy"))) {
    output += "This project uses rustfmt and clippy for code formatting.\n\n";
    output += "```bash\n";
    output += "# Check formatting\n";
    output += "cargo fmt --check\n";
    output += "cargo clippy\n\n";
    output += "# Format code\n";
    output += "cargo fmt\n";
    output += "```\n\n";
  }

  return output.trim();
}

export function generateTesting(
  scripts: Record<string, string> | undefined,
  packageManager?: string,
  testFiles: string[] = [],
): string {
  if (scripts?.test) {
    return "Run tests:\n\n```bash\n" + `${packageManager || "npm"} run test\n` + "```";
  } else if (packageManager === "cargo") {
    return "Run tests:\n\n```bash\ncargo test\n```";
  } else if (testFiles.length > 0) {
    return "Run tests:\n\n```bash\n# Add test command for your project\n```";
  } else {
    return "No tests configured yet. Consider adding tests for your project.";
  }
}

export function generateTreeStructure(analysis: ProjectAnalysis): string {
  const { mainFiles, entryPoints, configFiles, testFiles } = analysis;
  const allFiles = [...new Set([
    ...mainFiles,
    ...(entryPoints || []),
    ...(configFiles || []),
    ...(testFiles || []),
  ])].sort();

  const lines: string[] = [basename(analysis.name)];
  const dirs = new Set<string>();

  for (const file of allFiles) {
    const parts = file.split("/");
    if (parts.length > 1) {
      dirs.add(parts.slice(0, -1).join("/"));
    }
  }

  for (const dir of Array.from(dirs).sort()) {
    const depth = dir.split("/").length;
    const indent = "  ".repeat(depth);
    lines.push(`${indent}├── ${dir.split("/").pop()}/`);
  }

  for (const file of allFiles.slice(0, 20)) {
    const parts = file.split("/");
    const depth = parts.length - 1;
    const indent = "  ".repeat(depth);
    lines.push(`${indent}├── ${parts.pop()}`);
  }

  if (allFiles.length > 20) {
    lines.push(`  └── ... and ${allFiles.length - 20} more files`);
  }

  return lines.join("\n");
}
