/**
 * Model-facing tools for README generator.
 * 
 * Model-facing text (description, result text) stays English in every locale —
 * the agent is the one being instructed.
 */

import type { ExtensionAPI, AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { PluginState } from "../../shared/state.js";
import { ReadmeGeneratorEngine } from "./engine.js";
import type { ProgressStage } from "./types.js";

export function registerReadmeGeneratorTools(pi: ExtensionAPI, _state: PluginState): void {
	pi.registerTool({
		name: "readme_generator",
		label: "README Generator",
		description: "Analyze project, generate README.md, initialize git repository, and commit changes with structured messages",
		parameters: Type.Object({
			projectRoot: Type.Optional(Type.String({ description: "Project root directory (default: current working directory)" })),
			customMessage: Type.Optional(Type.String({ description: "Custom commit message (optional)" })),
		}),
		async execute(_toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: any, _ctx?: any): Promise<AgentToolResult<unknown>> {
			const projectRoot = params.projectRoot || process.cwd();
			
			// Create a simple progress reporter that logs to tool result
			const progressLog: ProgressStage[] = [];
			const updateStatus = (stage: ProgressStage) => {
				progressLog.push(stage);
			};
			
			const engine = new ReadmeGeneratorEngine(pi, projectRoot, updateStatus);
			
			try {
				const result = await engine.runFullWorkflow(params.customMessage);
				return {
					content: [{
						type: "text",
						text: `✅ README generated and committed successfully!\n\n` +
							  `Project: ${result.analysis.name} (${result.analysis.language}${result.analysis.framework ? `, ${result.analysis.framework}` : ''})\n` +
							  `Commit: ${result.commit.emoji} ${result.commit.message.split('\n')[0]}\n` +
							  `Files: ${result.commit.files.length} files\n` +
							  `First commit: ${result.commit.isFirstCommit ? 'Yes' : 'No'}`
					}],
					details: {
						analysis: result.analysis,
						commit: result.commit,
						progress: progressLog,
					}
				};
			} catch (error) {
				return {
					content: [{
						type: "text",
						text: `❌ Failed: ${error instanceof Error ? error.message : String(error)}`
					}],
					isError: true,
					details: { error: String(error), progress: progressLog }
				};
			}
		},
	});
}