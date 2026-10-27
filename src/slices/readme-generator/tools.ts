/**
 * Model-facing tool for README work.
 *
 * The tool is deliberately dumb: it gathers facts, writes a template when
 * explicitly asked, and commits exactly one file. The QUALITY of the README
 * comes from the agent following the bundled `readme-generator` skill —
 * never from this tool acting on its own.
 *
 * Model-facing text (description, result text) stays English in every
 * locale — the agent is the one being instructed.
 */

import type { ExtensionAPI, AgentToolResult, ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { PluginState } from "../../shared/state.js";
import { ProjectAnalyzer } from "./analyzer.js";
import { ReadmeBuilder } from "./readme-builder.js";
import { GitManager } from "./git-manager.js";
import { normalizeReadmeFrontmatter } from "./frontmatter.js";

function ok(text: string, details?: Record<string, unknown>): AgentToolResult<unknown> {
	return { content: [{ type: "text", text }], details };
}

function fail(text: string, details?: Record<string, unknown>): AgentToolResult<unknown> {
	return { content: [{ type: "text", text }], isError: true, details };
}

export function registerReadmeGeneratorTools(pi: ExtensionAPI, _state: PluginState): void {
	pi.registerTool({
		name: "readme_generator",
		label: "README Generator",
		description:
			"README helper for the current project. " +
			"action 'analyze': read-only structured facts about the project (language, framework, entry points, scripts, hasReadme). " +
			"action 'scaffold': write a generic template README.md — refuses to overwrite an existing README unless force=true. " +
			"action 'frontmatter': normalize README.md's YAML frontmatter to the canonical template — every field of FRONTMATTER_TEMPLATE present; " +
			"existing non-empty project.* values are preserved, missing ones are filled from a fresh analysis, analysis.* is regenerated. " +
			"action 'commit': normalize the frontmatter, then stage and commit ONLY the README file using the repository's existing git identity (auto-initializes local git if missing). Commits should always be made automatically after README creation/updates. " +
			"action 'init-git': ensure a local git repository exists (purely local, no remotes/pushes; sets fallback identity mastnacek <mastnacek@gmail.com> only if no effective git identity is configured). " +
			"For a real, high-quality README, follow the readme-generator skill instead of scaffolding.",
		parameters: Type.Object({
			action: StringEnum(["analyze", "scaffold", "frontmatter", "commit", "init-git"] as const),
			projectRoot: Type.Optional(Type.String({ description: "Project root directory (default: current working directory)" })),
			force: Type.Optional(Type.Boolean({ description: "scaffold only: overwrite an existing README.md (default: false)" })),
			message: Type.Optional(Type.String({ description: "commit only: commit message (default: conventional docs: message)" })),
		}),
		async execute(_toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: any, ctx?: ExtensionToolContext): Promise<AgentToolResult<unknown>> {
			const projectRoot = params.projectRoot || ctx?.cwd || process.cwd();

			switch (params.action as string) {
				case "analyze":
					return analyze(projectRoot);
				case "scaffold":
					return scaffold(projectRoot, Boolean(params.force));
				case "frontmatter":
					return frontmatter(projectRoot);
				case "commit":
					return commit(projectRoot, params.message);
				case "init-git":
					return initGit(projectRoot);
				default:
					return fail(`Unknown action "${params.action}". Use analyze | scaffold | frontmatter | commit | init-git.`);
			}
		},
	});
}

async function analyze(projectRoot: string): Promise<AgentToolResult<unknown>> {
	const analyzer = new ProjectAnalyzer(projectRoot);
	const analysis = await analyzer.analyze();

	const lines = [
		`Project: ${analysis.name}`,
		`Category: ${analysis.category ?? "not registered in ~/.pi/projects.json"}`,
		`Language: ${analysis.language}${analysis.framework ? `, Framework: ${analysis.framework}` : ""}`,
		`Package manager: ${analysis.packageManager ?? "unknown"}`,
		`Context: ${analysis.suggestedContext ?? "personal"} (personal vs work)`,
		`Status: ${analysis.suggestedStatus ?? "prototype"} | Progress: ${analysis.suggestedProgress ?? "in-progress"}`,
		`Quality: ${analysis.suggestedQuality ?? "experimental"} (tests: ${analysis.testFiles?.length ?? 0}, CI: ${analysis.hasCI ? "yes" : "no"}, types: ${analysis.hasTypes ? "yes" : "no"})`,
		`Entry points: ${analysis.entryPoints?.join(", ") || "none detected"}`,
		`Main files: ${analysis.mainFiles.join(", ") || "none detected"}`,
		`Config files: ${analysis.configFiles?.join(", ") || "none"}`,
		`Has README: ${analysis.hasReadme ? "yes" : "no"} | Has git: ${analysis.hasGit ? "yes" : "no"}`,
	];

	return ok(lines.join("\n"), { analysis });
}

async function scaffold(projectRoot: string, force: boolean): Promise<AgentToolResult<unknown>> {
	const readmePath = join(projectRoot, "README.md");

	let exists = false;
	try {
		await fs.access(readmePath);
		exists = true;
	} catch {
		// no README yet
	}

	if (exists && !force) {
		return fail(
			"README.md already exists — template was NOT written. " +
			"Do not overwrite it blindly: read it, then update it section by section with the write/edit tools. " +
			"Pass force=true only when the user explicitly asked for a full template replacement."
		);
	}

	const analyzer = new ProjectAnalyzer(projectRoot);
	const analysis = await analyzer.analyze();
	const content = new ReadmeBuilder(analysis).build();
	await fs.writeFile(readmePath, content, "utf-8");

	return ok(
		`Template README.md written (${content.split("\n").length} lines). ` +
		`This is a generic scaffold — review every section against the real code before showing it to the user.`,
		{ analysis, path: readmePath }
	);
}

async function frontmatter(projectRoot: string): Promise<AgentToolResult<unknown>> {
	const readmePath = join(projectRoot, "README.md");
	let content: string;
	try {
		content = await fs.readFile(readmePath, "utf-8");
	} catch {
		return fail("No README.md at the project root — write one first (or use action 'scaffold').");
	}

	const analysis = await new ProjectAnalyzer(projectRoot).analyze();
	const result = normalizeReadmeFrontmatter(content, analysis);

	if (!result.changed) {
		return ok(
			"Frontmatter already matches the canonical template — file unchanged. " +
			"Fill any empty project.* values (especially description) with the edit tool.",
			{ analysis }
		);
	}

	await fs.writeFile(readmePath, result.content, "utf-8");
	return ok(
		`Frontmatter normalized to the canonical template. ` +
		`Filled from analysis: ${result.filled.join(", ") || "none"}. ` +
		`Preserved existing: ${result.preserved.join(", ") || "none"}. ` +
		`Next: fill empty project.* values (especially description) with the edit tool.`,
		{ analysis, filled: result.filled, preserved: result.preserved, path: readmePath }
	);
}

async function commit(projectRoot: string, message?: string): Promise<AgentToolResult<unknown>> {
	const git = new GitManager(projectRoot);
	try {
		// Enforce the canonical frontmatter before every commit: normalize
		// in place from a fresh analysis (no-op when already conforming).
		const readme = await git.findReadme();
		let normalizedNote = "";
		if (readme) {
			const readmePath = join(projectRoot, readme);
			const content = await fs.readFile(readmePath, "utf-8");
			const analysis = await new ProjectAnalyzer(projectRoot).analyze();
			const result = normalizeReadmeFrontmatter(content, analysis);
			if (result.changed) {
				await fs.writeFile(readmePath, result.content, "utf-8");
				normalizedNote =
					` Frontmatter was auto-normalized to the canonical template ` +
					`(filled: ${result.filled.join(", ") || "none"}) — review the empty project.* values.`;
			}
		}

		const result = await git.commitReadme(message);
		if (result.files.length === 0) {
			return ok(result.message + normalizedNote);
		}
		return ok(
			`Committed ${result.files.join(", ")} — "${result.message.split("\n")[0]}"` +
			(result.isFirstCommit ? " (first commit)" : "") +
			normalizedNote,
			{ commit: result }
		);
	} catch (error) {
		return fail(error instanceof Error ? error.message : String(error));
	}
}

async function initGit(projectRoot: string): Promise<AgentToolResult<unknown>> {
	const git = new GitManager(projectRoot);
	try {
		const created = await git.ensureRepository();
		if (created) {
			return ok("Initialized local git repository.");
		}
		return ok("Local git repository already exists.");
	} catch (error) {
		return fail(error instanceof Error ? error.message : String(error));
	}
}
