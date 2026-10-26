/**
 * Tools slice for pi-readme-generator.
 *
 * Model-facing text (description, result text) stays English in every locale —
 * the agent is the one being instructed. The Multilingual UI invariant exempts it.
 */

import type { ExtensionAPI, AgentToolResult } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import type { PluginState } from "../../shared/state.js";

const ActionSchema = StringEnum(["status", "ping"] as const);

export function registerTools(pi: ExtensionAPI, state: PluginState): void {
	pi.registerTool({
		name: "pi_readme_generator_status",
		label: "pi-readme-generator Status",
		description: "Check status of pi-readme-generator plugin",
		parameters: Type.Object({
			action: ActionSchema,
		}),
		async execute(_toolCallId, params): Promise<AgentToolResult<unknown>> {
			if (params.action === "status") {
				return {
					content: [{ type: "text", text: "Plugin pi-readme-generator status: OK (enabled=" + state.enabled + ")" }],
					details: {},
				};
			}
			return {
				content: [{ type: "text", text: "pong" }],
				details: {},
			};
		},
	});
}