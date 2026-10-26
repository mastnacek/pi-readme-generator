/**
 * pi-readme-generator — Pi coding agent extension.
 *
 * Composition root only: registers listeners, wires slices,
 * drains listeners on session_shutdown, and guards against subagent recursion.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createInitialState } from "./src/shared/state.js";
import { registerReadmeGeneratorCommands } from "./src/slices/readme-generator/commands.js";
import { registerReadmeGeneratorTools } from "./src/slices/readme-generator/tools.js";
import { registerReadmeFrontmatterHooks } from "./src/slices/readme-generator/hooks.js";

/** Subagent recursion guard: avoid duplicating hooks in child sessions. */
function isDelegatedSession(): boolean {
	return process.env.PI_SUBAGENT === "true" || Boolean(process.env.PI_CHILD_SESSION);
}

export default function (pi: ExtensionAPI): void {
	if (isDelegatedSession()) {
		return;
	}

	const state = createInitialState();
	const unsubscribers: Array<() => void> = [];
	const track = (result: unknown): void => {
		if (typeof result === "function") unsubscribers.push(result as () => void);
	};

	// Wire slices - readme-generator commands, tools, and enforcement hooks
	track(registerReadmeGeneratorCommands(pi, state));
	track(registerReadmeGeneratorTools(pi, state));
	track(registerReadmeFrontmatterHooks(pi, state));

	// Drain all listeners on session shutdown
	pi.on("session_shutdown", async () => {
		while (unsubscribers.length > 0) {
			unsubscribers.pop()?.();
		}
	});
}