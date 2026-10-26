/**
 * Commands slice for README generator — single command interface.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { stringsFor, type Locale } from "../../shared/i18n.js";
import type { PluginState } from "../../shared/state.js";
import { ReadmeGeneratorEngine } from "./engine.js";
import type { ProgressStage } from "./types.js";

export function registerReadmeGeneratorCommands(pi: ExtensionAPI, state: PluginState): void {
	const s = stringsFor(state.lang);
	
	pi.registerCommand("readme-gen", {
		description: s.readmeGenDesc,
		getArgumentCompletions: (prefix: string) => readmeGenCompletions(prefix, state.lang, s),
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) return;
			
			const projectRoot = ctx.cwd;
			const customMessage = args.trim() || undefined;
			
			const updateStatus = (stage: ProgressStage) => {
				ctx.ui.setStatus(`README Gen: ${stage.message} (${stage.progress}%)`, 'info');
				if (stage.details) {
					ctx.ui.notify(stage.details, "info");
				}
			};
			
			ctx.ui.setStatus("README Gen: Starting analysis...", 'info');
			ctx.ui.notify("🔍 Analyzing project structure...", "info");
			
			try {
				const engine = new ReadmeGeneratorEngine(pi, projectRoot, updateStatus);
				const result = await engine.runFullWorkflow(customMessage);
				
				ctx.ui.setStatus(`README Gen: Complete! ${result.commit.emoji} ${result.commit.message.split('\n')[0]}`, 'info');
				ctx.ui.notify(`✅ ${s.done} README generated and committed!`, "info");
				
				if (result.commit.isFirstCommit) {
					ctx.ui.notify(`🎉 First commit created with ${result.commit.files.length} files`, "info");
				} else {
					ctx.ui.notify(`📝 Revision commit: ${result.commit.emoji} ${result.commit.message.split('\n')[0]}`, "info");
				}
			} catch (error) {
				ctx.ui.setStatus("README Gen: Error", 'error');
				ctx.ui.notify(`❌ Failed: ${error}`, "error");
			}
		},
	});
}

function readmeGenCompletions(prefix: string, _lang: Locale, s: any): { value: string; label: string; description: string }[] | null {
	// Only offer the optional custom message completion
	const text = prefix.trimStart();
	if (!text) {
		return [{
			value: '"custom commit message"',
			label: s.generateDesc,
			description: "Optional custom commit message (quoted)",
		}];
	}
	return null;
}