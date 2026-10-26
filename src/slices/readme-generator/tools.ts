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

import type { ExtensionAPI, AgentToolResult } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { PluginState } from "../../shared/state.js";
import { ProjectAnalyzer } from "./analyzer.js";
import { ReadmeBuilder } from "./readme-builder.js";
import { GitManager } from "./git-manager.js";

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
			"action 'commit': stage and commit ONLY the README file using the repository's existing git identity. " +
			"For a real, high-quality README, follow the readme-generator skill instead of scaffolding.",
		parameters: Type.Object({
			action: StringEnum(["analyze", "scaffold", "commit"] as const),
			projectRoot: Type.Optional(Type.String({ description: "Project root directory (default: current working directory)" })),
			force: Type.Optional(Type.Boolean({ description: "scaffold only: overwrite an existing README.md (default: false)" })),
			message: Type.Optional(Type.String({ description: "commit only: commit message (default: conventional docs: message)" })),
		}),
		async execute(_toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: any, _ctx?: any): Promise<AgentToolResult<unknown>> {
			const projectRoot = params.projectRoot || process.cwd();

			switch (params.action as string) {
				case "analyze":
					return analyze(projectRoot);
				case "scaffold":
					return scaffold(projectRoot, Boolean(params.force));
				case "commit":
					return commit(projectRoot, params.message);
				default:
					return fail(`Unknown action "${params.action}". Use analyze | scaffold | commit.`);
			}
		},
	});
}

async function analyze(projectRoot: string): Promise<AgentToolResult<unknown>> {
	const analyzer = new ProjectAnalyzer(projectRoot);
	const analysis = await analyzer.analyze();

	const lines = [
		`Project: ${analysis.name}`,
		`Language: ${analysis.language}${analysis.framework ? `, Framework: ${analysis.framework}` : ""}`,
		`Package manager: ${analysis.packageManager ?? "unknown"}`,
		`Entry points: ${analysis.entryPoints?.join(", ") || "none detected"}`,
		`Main files: ${analysis.mainFiles.join(", ") || "none detected"}`,
		`Config files: ${analysis.configFiles?.join(", ") || "none"}`,
		`Test files: ${analysis.testFiles?.length ?? 0}`,
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

async function commit(projectRoot: string, message?: string): Promise<AgentToolResult<unknown>> {
	const git = new GitManager(projectRoot);
	try {
		const result = await git.commitReadme(message);
		if (result.files.length === 0) {
			return ok(result.message);
		}
		return ok(
			`Committed ${result.files.join(", ")} — "${result.message.split("\n")[0]}"` +
			(result.isFirstCommit ? " (first commit)" : ""),
			{ commit: result }
		);
	} catch (error) {
		return fail(error instanceof Error ? error.message : String(error));
	}
}
