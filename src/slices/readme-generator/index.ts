/**
 * README Generator slice barrel.
 */

export { ProjectAnalyzer } from "./analyzer.js";
export { ReadmeBuilder } from "./readme-builder.js";
export { GitManager } from "./git-manager.js";
export { registerReadmeGeneratorTools } from "./tools.js";
export { registerReadmeFrontmatterHooks } from "./hooks.js";
export {
	PLUGIN_VERSION,
	FRONTMATTER_TEMPLATE,
	generateFrontmatter,
	normalizeReadmeFrontmatter,
	validateFrontmatterStructure,
	parseFrontmatter,
	type FrontmatterSection,
	type ParsedFrontmatter,
	type NormalizeResult,
	type FrontmatterValidation,
} from "./frontmatter.js";
export type { ProjectAnalysis, GitCommitInfo, ReadmeAction } from "./types.js";
