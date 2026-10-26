/**
 * Frontmatter enforcement hook.
 *
 * After the agent's `write`/`edit` tool successfully touches the
 * project-root README.md, the frontmatter is re-normalized to the
 * canonical template in place (see frontmatter.ts). Agent-written
 * project.* values survive; the structure is not negotiable.
 *
 * The hook only fires on the ROOT README.md of the current working
 * directory — nested READMEs (docs/, demos, vendor) are not its business.
 * The rewrite happens through fs, not through a tool, so it cannot
 * retrigger itself. A conforming README is left byte-identical.
 *
 * Returns the unsubscribe function — the composition root stores it and
 * drains it on session_shutdown.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { TextContent } from "@earendil-works/pi-ai";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import type { PluginState } from "../../shared/state.js";
import { ProjectAnalyzer } from "./analyzer.js";
import { normalizeReadmeFrontmatter } from "./frontmatter.js";

function isRootReadme(inputPath: unknown, cwd: string): boolean {
	if (typeof inputPath !== "string" || inputPath.trim() === "") return false;
	const normalized = resolve(cwd, inputPath).replace(/\\/g, "/").toLowerCase();
	const rootReadme = resolve(cwd, "README.md").replace(/\\/g, "/").toLowerCase();
	return normalized === rootReadme;
}

export function registerReadmeFrontmatterHooks(pi: ExtensionAPI, _state: PluginState): () => void {
	const unsubscribe = pi.on("tool_result", async (event, ctx) => {
		if (event.isError) return;
		if (event.toolName !== "write" && event.toolName !== "edit") return;
		if (!isRootReadme(event.input?.path, ctx.cwd)) return;

		let content: string;
		const readmePath = resolve(ctx.cwd, "README.md");
		try {
			content = await fs.readFile(readmePath, "utf-8");
		} catch {
			return;
		}

		const analysis = await new ProjectAnalyzer(ctx.cwd).analyze();
		const result = normalizeReadmeFrontmatter(content, analysis);
		if (!result.changed) return;

		await fs.writeFile(readmePath, result.content, "utf-8");

		const note: TextContent = {
			type: "text",
			text:
				`[pi-readme-generator] README.md frontmatter was normalized to the canonical ` +
				`template (filled from analysis: ${result.filled.join(", ") || "none"}; ` +
				`preserved: ${result.preserved.join(", ") || "none"}). ` +
				`The file on disk now differs from what this tool wrote — re-read the ` +
				`frontmatter block before editing it again.`,
		};
		return { content: [...event.content, note] };
	});

	return unsubscribe;
}
