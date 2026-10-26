/**
 * Shared state kernel for pi-readme-generator.
 * Shared across slices; slices never import each other directly.
 */

import { DEFAULT_LOCALE, type Locale } from "./i18n.js";

export interface PluginState {
	enabled: boolean;
	/** UI language; every user-facing string resolves through the i18n table. */
	lang: Locale;
	lastRunTimestamp: number;
}

export function createInitialState(): PluginState {
	return {
		enabled: true,
		lang: DEFAULT_LOCALE,
		lastRunTimestamp: 0,
	};
}
