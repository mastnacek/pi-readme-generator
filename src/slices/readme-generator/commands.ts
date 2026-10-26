/**
 * Commands slice for README generator.
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
			const tokens = args.trim().split(/\s+/).filter(Boolean);
			const sub = (tokens[0] ?? "generate").toLowerCase();

			if (sub === "generate" || sub === "g") {
				await handleGenerate(pi, ctx, tokens.slice(1), s);
				return;
			}

			if (sub === "analyze" || sub === "a") {
				await handleAnalyze(pi, ctx, s);
				return;
			}

			if (sub === "commit" || sub === "c") {
				await handleCommit(pi, ctx, tokens.slice(1), s);
				return;
			}

			if (sub === "status" || sub === "s") {
				await handleStatus(ctx, s, state);
				return;
			}

			if (sub === "lang") {
				const requested = tokens[1]?.toLowerCase();
				if (!requested || !["en", "cs"].includes(requested)) {
					if (ctx.hasUI) {
						ctx.ui.notify(`Usage: /readme-gen lang <en|cs>`, "warning");
					}
					return;
				}
				state.lang = requested as Locale;
				if (ctx.hasUI) ctx.ui.notify(`${s.title}: ${state.lang}`, "info");
				return;
			}

			if (!ctx.hasUI) return;
			ctx.ui.notify(`Unknown subcommand: ${sub}. Use: generate, analyze, commit, status, lang`, "warning");
		},
	});
}

async function handleGenerate(pi: ExtensionAPI, ctx: ExtensionCommandContext, tokens: string[], s: any): Promise<void> {
	if (!ctx.hasUI) return;
	
	const projectRoot = ctx.cwd;
	const customMessage = tokens.join(" ");
	
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
		const result = await engine.runFullWorkflow(customMessage || undefined);
		
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
}

async function handleAnalyze(pi: ExtensionAPI, ctx: ExtensionCommandContext, s: any): Promise<void> {
	if (!ctx.hasUI) return;
	
	const projectRoot = ctx.cwd;
	ctx.ui.notify("🔍 Analyzing project...", "info");
	
	try {
		const engine = new ReadmeGeneratorEngine(pi, projectRoot, (stage) => {
			ctx.ui.notify(`${stage.message} (${stage.progress}%)`, "info");
		});
		
		const analysis = await engine.analyze();
		
		ctx.ui.notify(`✅ Analysis complete: ${analysis.name} (${analysis.language}${analysis.framework ? `, ${analysis.framework}` : ''})`, "info");
		ctx.ui.notify(`📁 ${analysis.mainFiles.length} main files, ${analysis.configFiles?.length ?? 0} configs, ${analysis.testFiles?.length ?? 0} tests`, "info");
		ctx.ui.notify(`📦 Package manager: ${analysis.packageManager || 'none detected'}`, "info");
		ctx.ui.notify(`📝 README exists: ${analysis.hasReadme ? 'yes' : 'no'}`, "info");
		ctx.ui.notify(`🔧 Git repo: ${analysis.hasGit ? 'yes' : 'no'}`, "info");
	} catch (error) {
		ctx.ui.notify(`❌ Analysis failed: ${error}`, "error");
	}
}

async function handleCommit(pi: ExtensionAPI, ctx: ExtensionCommandContext, tokens: string[], s: any): Promise<void> {
	if (!ctx.hasUI) return;
	
	const projectRoot = ctx.cwd;
	const customMessage = tokens.join(" ");
	
	ctx.ui.notify("📦 Staging and committing changes...", "info");
	
	try {
		const engine = new ReadmeGeneratorEngine(pi, projectRoot, (stage) => {
			ctx.ui.notify(`${stage.message} (${stage.progress}%)`, "info");
		});
		
		const commit = await engine.commitChanges(customMessage || undefined);
		
		ctx.ui.notify(`✅ ${s.done} Commit: ${commit.emoji} ${commit.message.split('\n')[0]}`, "info");
		ctx.ui.notify(`📁 ${commit.files.length} files committed`, "info");
	} catch (error) {
		ctx.ui.notify(`❌ Commit failed: ${error}`, "error");
	}
}

async function handleStatus(ctx: ExtensionCommandContext, s: any, state: PluginState): Promise<void> {
	if (!ctx.hasUI) return;
	ctx.ui.notify(s.status(state.enabled), "info");
}

function readmeGenCompletions(prefix: string, lang: Locale, s: any): { value: string; label: string; description: string }[] | null {
	const text = prefix.trimStart();
	const head = text.split(/\s+/)[0]?.toLowerCase() ?? "";

	const subcommands = ["generate", "analyze", "commit", "status", "lang"];
	
	if (head === "lang") {
		const typed = text.slice("lang".length).trim().toLowerCase();
		const rows = ["en", "cs"].map((locale) => ({
			value: `lang ${locale}`,
			label: lang === locale ? `${locale} ✓` : locale,
			description: `UI language${lang === locale ? " · ● AKTIVNÍ" : ""}`,
		})).filter((row) => row.value.toLowerCase().startsWith(`lang ${typed}`));
		return rows.length > 0 ? rows : null;
	}

	if (head !== "" && !subcommands.some(cmd => cmd.startsWith(head))) return null;
	
	const rows = subcommands
		.filter(cmd => cmd.startsWith(head))
		.map(cmd => ({
			value: cmd === "lang" ? "lang " : cmd + " ",
			label: cmd,
			description: getSubcommandDescription(cmd, s),
		}));
	
	return rows.length > 0 ? rows : null;
}

function getSubcommandDescription(cmd: string, s: any): string {
	const descriptions: Record<string, string> = {
		generate: s.generateDesc,
		analyze: s.analyzeDesc,
		commit: s.commitDesc,
		status: s.statusDesc,
		lang: s.langDesc,
	};
	return descriptions[cmd] || "";
}