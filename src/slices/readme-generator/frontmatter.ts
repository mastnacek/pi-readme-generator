/**
 * YAML frontmatter for README files — canonical fixed structure.
 *
 * Every README this plugin touches carries the SAME frontmatter shape:
 * every field below, in this exact order, always present. Unknown values
 * are empty ("", [], 0, {}) — fields are never omitted. The agent fills
 * values in from project analysis; the structure is not negotiable.
 *
 * Enforcement points:
 * - `scaffold` writes this block (ReadmeBuilder),
 * - the `frontmatter` tool action normalizes an existing README in place,
 * - the write/edit `tool_result` hook re-normalizes the project-root
 *   README.md after the agent touches it,
 * - the commit gate (GitManager) refuses anything off-template.
 */

import type { ProjectAnalysis } from "./types.js";

/** Keep in sync with package.json — test/frontmatter.test.ts asserts it. */
export const PLUGIN_VERSION = "0.3.0";

/**
 * The canonical field set and order. Structure is fixed; only values vary.
 * Adding a field here automatically makes it mandatory everywhere:
 * generator, normalizer, validator and tests all derive from this table.
 */
export const FRONTMATTER_TEMPLATE = {
	project: ["name", "description", "language", "category", "framework", "packageManager"],
	analysis: [
		"hasGit", "hasReadme", "mainFiles", "entryPoints", "configFiles",
		"testFiles", "testFileCount", "dependencies", "devDependencies", "scripts",
	],
	generator: ["tool", "version", "timestamp"],
} as const;

export type FrontmatterSection = keyof typeof FRONTMATTER_TEMPLATE;

export interface ParsedFrontmatter {
	/** section -> key -> unquoted scalar value (arrays/objects kept as JSON text). */
	values: Record<string, Record<string, string>>;
	/** The exact block text between the --- markers (no markers). */
	block: string;
	/** Everything after the closing --- marker. */
	body: string;
}

export interface NormalizeResult {
	content: string;
	changed: boolean;
	/** project.* fields filled from analysis because they were missing/empty. */
	filled: string[];
	/** project.* fields kept from the existing frontmatter (agent-written). */
	preserved: string[];
}

export interface FrontmatterValidation {
	ok: boolean;
	/** Dotted paths of missing fields, e.g. "project.category". */
	missing: string[];
}

function yamlEscape(value: string): string {
	return value.replace(/\n/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Analysis-derived value for one analysis.* field, always defined. */
function analysisFieldValue(analysis: ProjectAnalysis, key: string): string {
	switch (key) {
		case "hasGit": return String(analysis.hasGit);
		case "hasReadme": return String(analysis.hasReadme);
		case "mainFiles": return JSON.stringify(analysis.mainFiles ?? []);
		case "entryPoints": return JSON.stringify((analysis.entryPoints ?? []).slice(0, 20));
		case "configFiles": return JSON.stringify((analysis.configFiles ?? []).slice(0, 20));
		case "testFiles": return JSON.stringify((analysis.testFiles ?? []).slice(0, 20));
		case "testFileCount": return String(analysis.testFiles?.length ?? 0);
		case "dependencies": return JSON.stringify(Object.keys(analysis.dependencies ?? {}));
		case "devDependencies": return JSON.stringify(Object.keys(analysis.devDependencies ?? {}));
		case "scripts": return JSON.stringify(analysis.scripts ?? {});
		default: return '""';
	}
}

/** Analysis-derived default for one project.* field ("" when unknown). */
function projectFieldDefault(analysis: ProjectAnalysis, key: string): string {
	switch (key) {
		case "name": return analysis.name ?? "";
		case "description": return analysis.description ?? "";
		case "language": return analysis.language ?? "";
		case "category": return analysis.category ?? "";
		case "framework": return analysis.framework ?? "";
		case "packageManager": return analysis.packageManager ?? "";
		default: return "";
	}
}

/**
 * Render the canonical block. Every template field is emitted, always in
 * template order. `projectValues` supplies the final project.* scalars
 * (already merged); everything else comes from the analysis.
 */
function renderBlock(
	analysis: ProjectAnalysis,
	projectValues: Record<string, string>,
	timestamp: string,
): string {
	const lines: string[] = [];

	lines.push("project:");
	for (const key of FRONTMATTER_TEMPLATE.project) {
		lines.push(`  ${key}: "${yamlEscape(projectValues[key] ?? "")}"`);
	}

	lines.push("analysis:");
	for (const key of FRONTMATTER_TEMPLATE.analysis) {
		lines.push(`  ${key}: ${analysisFieldValue(analysis, key)}`);
	}

	lines.push("generator:");
	for (const key of FRONTMATTER_TEMPLATE.generator) {
		if (key === "tool") lines.push(`  tool: "pi-readme-generator"`);
		else if (key === "version") lines.push(`  version: "${PLUGIN_VERSION}"`);
		else lines.push(`  timestamp: "${timestamp}"`);
	}

	return lines.join("\n");
}

/**
 * Generate the canonical frontmatter block for a fresh README.
 * All fields are always present; unknowns are empty.
 */
export function generateFrontmatter(analysis: ProjectAnalysis): string {
	const projectValues: Record<string, string> = {};
	for (const key of FRONTMATTER_TEMPLATE.project) {
		projectValues[key] = projectFieldDefault(analysis, key);
	}
	return renderBlock(analysis, projectValues, new Date().toISOString());
}

/**
 * Parse an existing frontmatter block. Minimal YAML subset: top-level
 * `section:` keys and two-space-indented `key: value` scalars. Quoted
 * strings are unquoted; arrays/objects keep their JSON text form.
 * Returns null when the document does not start with a frontmatter block.
 */
export function parseFrontmatter(content: string): ParsedFrontmatter | null {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith("---")) return null;

	const afterOpening = trimmed.slice(3);
	const closingMatch = /\n---[ \t]*(\r?\n|$)/.exec(afterOpening);
	if (!closingMatch) return null;

	const block = afterOpening.slice(0, closingMatch.index).trim();
	const body = afterOpening.slice(closingMatch.index + closingMatch[0].length);

	const values: Record<string, Record<string, string>> = {};
	let section = "";
	for (const line of block.split(/\r?\n/)) {
		const sectionMatch = /^(\w+):\s*$/.exec(line);
		if (sectionMatch) {
			section = sectionMatch[1];
			values[section] = values[section] ?? {};
			continue;
		}
		const fieldMatch = /^ {2}(\w+):\s*(.*)$/.exec(line);
		if (fieldMatch && section) {
			let raw = fieldMatch[2].trim();
			if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
				raw = raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
			}
			values[section][fieldMatch[1]] = raw;
		}
	}

	return { values, block, body };
}

/**
 * Validate that the content starts with a frontmatter block containing
 * every canonical field. Presence only — values may be empty.
 */
export function validateFrontmatterStructure(content: string): FrontmatterValidation {
	const parsed = parseFrontmatter(content);
	const missing: string[] = [];

	if (!parsed) {
		for (const [section, keys] of Object.entries(FRONTMATTER_TEMPLATE)) {
			for (const key of keys) missing.push(`${section}.${key}`);
		}
		return { ok: false, missing };
	}

	for (const [section, keys] of Object.entries(FRONTMATTER_TEMPLATE)) {
		for (const key of keys) {
			if (!(key in (parsed.values[section] ?? {}))) {
				missing.push(`${section}.${key}`);
			}
		}
	}
	return { ok: missing.length === 0, missing };
}

/**
 * Bring a README's frontmatter to the canonical template.
 *
 * - No frontmatter: the full block is generated from the analysis and
 *   prepended; the original content becomes the body.
 * - Existing frontmatter: project.* scalars that are present and non-empty
 *   are PRESERVED (they are the agent's curated text); missing or empty
 *   project.* fields are filled from the analysis. analysis.* is always
 *   regenerated from a fresh analysis. generator.tool/version are pinned;
 *   the existing timestamp is kept (a new one is stamped only when the
 *   block is generated from scratch).
 *
 * The document is rewritten only when the canonical block differs from the
 * existing one — a conforming README is returned byte-identical.
 */
export function normalizeReadmeFrontmatter(content: string, analysis: ProjectAnalysis): NormalizeResult {
	const parsed = parseFrontmatter(content);
	const filled: string[] = [];
	const preserved: string[] = [];

	const projectValues: Record<string, string> = {};
	for (const key of FRONTMATTER_TEMPLATE.project) {
		const existing = parsed?.values.project?.[key] ?? "";
		if (existing.trim() !== "") {
			projectValues[key] = existing;
			preserved.push(`project.${key}`);
		} else {
			projectValues[key] = projectFieldDefault(analysis, key);
			filled.push(`project.${key}`);
		}
	}

	const existingTimestamp = parsed?.values.generator?.timestamp ?? "";
	const timestamp = existingTimestamp.trim() !== "" ? existingTimestamp : new Date().toISOString();

	const block = renderBlock(analysis, projectValues, timestamp);

	if (parsed && parsed.block === block) {
		return { content, changed: false, filled: [], preserved };
	}

	const body = parsed ? parsed.body : (content.startsWith("\n") ? content : "\n\n" + content.trimStart());
	const newContent = `---\n${block}\n---\n${body.startsWith("\n") ? body : "\n" + body}`;
	return { content: newContent, changed: true, filled, preserved };
}
