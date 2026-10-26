/**
 * Commands slice — `/readme-gen` delegates the work to the agent.
 *
 * The command never runs a hidden workflow. It hands the agent a prompt that
 * points at the bundled `readme-generator` skill, so the user sees the agent
 * actually working (and can steer it) instead of a silent template dump.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { stringsFor } from "../../shared/i18n.js";
import type { PluginState } from "../../shared/state.js";

export function registerReadmeGeneratorCommands(pi: ExtensionAPI, state: PluginState): void {
	const s = stringsFor(state.lang);

	pi.registerCommand("readme-gen", {
		description: s.readmeGenDesc,
		getArgumentCompletions: (prefix: string) => {
			if (!prefix.trim()) {
				return [{
					value: "",
					label: s.extraArgsDesc,
					description: s.extraArgsHint,
				}];
			}
			return null;
		},
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const extra = args.trim();
			// Model-facing prompt — intentionally English in every locale.
			const prompt = [
				`Generate or update the README.md for the project at ${ctx.cwd}.`,
				`Load the "readme-generator" skill and follow its workflow exactly.`,
				extra ? `Additional instructions from the user: ${extra}` : "",
			].filter(Boolean).join("\n");

			// Delivered as a normal user message: starts a turn when idle,
			// queues behind the current run otherwise.
			pi.sendUserMessage(prompt);

			if (ctx.hasUI) {
				ctx.ui.notify(s.agentDelegated, "info");
			}
		},
	});
}
