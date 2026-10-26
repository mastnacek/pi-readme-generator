/**
 * Tests for the canonical frontmatter contract:
 * template, parsing, normalization, structure validation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	FRONTMATTER_TEMPLATE,
	PLUGIN_VERSION,
	generateFrontmatter,
	normalizeReadmeFrontmatter,
	validateFrontmatterStructure,
	parseFrontmatter,
} from "../src/slices/readme-generator/frontmatter.js";
import type { ProjectAnalysis } from "../src/slices/readme-generator/types.js";

function makeAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
	return {
		name: "demo-project",
		description: "",
		language: "TypeScript",
		framework: undefined,
		mainFiles: ["index.ts"],
		packageManager: "npm",
		entryPoints: ["index.ts"],
		scripts: { test: "node --test" },
		hasGit: true,
		hasReadme: true,
		...overrides,
	};
}

describe("generateFrontmatter", () => {
	it("emits every canonical field in template order", () => {
		const fm = generateFrontmatter(makeAnalysis());
		assert.match(fm, /^project:\n/m);
		assert.match(fm, /^  name: "demo-project"$/m);
		assert.match(fm, /^  description: ""$/m);
		assert.match(fm, /^  category: ""$/m);
		assert.match(fm, /^  framework: ""$/m);
		assert.match(fm, /^  status: "prototype"$/m);
		assert.match(fm, /^  quality: "experimental"$/m);
		assert.match(fm, /^  context: "personal"$/m);
		assert.match(fm, /^  progress: "in-progress"$/m);
		assert.match(fm, /^  hasGit: true$/m);
		assert.match(fm, /^  hasReadme: true$/m);
		assert.match(fm, /^  entryPoints: \["index\.ts"\]$/m);
		assert.match(fm, /^  scripts: \{"test":"node --test"\}$/m);
		assert.match(fm, /^  testFileCount: 0$/m);
		assert.match(fm, /^  tool: "pi-readme-generator"$/m);
		assert.match(fm, /^  version: "/m);
		assert.match(fm, /^  timestamp: "\d{4}-\d{2}-\d{2}T/m);
	});

	it("passes structure validation", () => {
		const doc = "---\n" + generateFrontmatter(makeAnalysis()) + "\n---\n# T\n";
		const check = validateFrontmatterStructure(doc);
		assert.equal(check.ok, true);
		assert.deepEqual(check.missing, []);
	});
});

describe("validateFrontmatterStructure", () => {
	it("rejects missing frontmatter", () => {
		const check = validateFrontmatterStructure("# No frontmatter\n");
		assert.equal(check.ok, false);
		const totalFields = Object.values(FRONTMATTER_TEMPLATE).reduce((n, keys) => n + keys.length, 0);
		assert.equal(check.missing.length, totalFields);
	});

	it("rejects partial frontmatter", () => {
		const partial = "---\nproject:\n  name: x\n---\n# T\n";
		const check = validateFrontmatterStructure(partial);
		assert.equal(check.ok, false);
		assert.ok(check.missing.includes("project.category"));
		assert.ok(check.missing.includes("generator.tool"));
	});
});

describe("normalizeReadmeFrontmatter", () => {
	it("adds frontmatter to a README that has none", () => {
		const result = normalizeReadmeFrontmatter("# Title\n\nBody.\n", makeAnalysis());
		assert.equal(result.changed, true);
		assert.ok(result.content.startsWith("---\n"));
		assert.ok(result.content.includes("# Title"));
		assert.ok(result.content.includes("Body."));
		assert.deepEqual(result.preserved, []);
		assert.ok(result.filled.includes("project.name"));
		assert.equal(validateFrontmatterStructure(result.content).ok, true);
	});

	it("preserves existing non-empty project.* values and maps aliases", () => {
		const existing =
			"---\n" +
			"project:\n" +
			'  description: "My real description"\n' +
			'  category: "cli-tools"\n' +
			'  state: "in-development"\n' +
			'  audience: "work"\n' +
			"---\n# T\n";
		const result = normalizeReadmeFrontmatter(existing, makeAnalysis());
		assert.equal(result.changed, true);
		assert.match(result.content, /^  description: "My real description"$/m);
		assert.match(result.content, /^  category: "cli-tools"$/m);
		assert.match(result.content, /^  status: "in-development"$/m);
		assert.match(result.content, /^  context: "work"$/m);
		assert.ok(result.preserved.includes("project.description"));
		assert.ok(result.preserved.includes("project.category"));
		assert.ok(result.preserved.includes("project.status"));
		assert.ok(result.preserved.includes("project.context"));
		assert.equal(validateFrontmatterStructure(result.content).ok, true);
	});

	it("keeps the existing generator.timestamp", () => {
		const existing =
			"---\ngenerator:\n  timestamp: \"2020-01-01T00:00:00.000Z\"\n---\n# T\n";
		const result = normalizeReadmeFrontmatter(existing, makeAnalysis());
		assert.match(result.content, /^  timestamp: "2020-01-01T00:00:00\.000Z"$/m);
	});

	it("is idempotent on a canonical README", () => {
		const content = "---\n" + generateFrontmatter(makeAnalysis()) + "\n---\n# T\n";
		const once = normalizeReadmeFrontmatter(content, makeAnalysis());
		const twice = normalizeReadmeFrontmatter(once.content, makeAnalysis());
		assert.equal(twice.changed, false);
		assert.equal(twice.content, once.content);
	});

	it("regenerates analysis.* from a fresh analysis even when values existed", () => {
		const existing =
			"---\nanalysis:\n  testFileCount: 99\n---\n# T\n";
		const result = normalizeReadmeFrontmatter(existing, makeAnalysis({ testFiles: ["a.test.ts"] }));
		assert.match(result.content, /^  testFileCount: 1$/m);
	});
});

describe("parseFrontmatter", () => {
	it("parses sections and indented keys", () => {
		const parsed = parseFrontmatter("---\nproject:\n  name: demo\n---\n# T\n");
		assert.ok(parsed !== null);
		assert.equal(parsed.values.project?.name, "demo");
		assert.equal(parsed.body, "# T\n");
	});

	it("returns null without a frontmatter block", () => {
		assert.equal(parseFrontmatter("# Just markdown\n"), null);
	});
});

describe("version", () => {
	it("matches package.json", async () => {
		const { readFile } = await import("node:fs/promises");
		const { join } = await import("node:path");
		const pkg = JSON.parse(
			await readFile(join(import.meta.dirname, "..", "..", "package.json"), "utf-8")
		);
		assert.equal(PLUGIN_VERSION, pkg.version);
	});
});
