/**
 * i18n kernel for pi-readme-generator.
 *
 * One table per locale, one lookup, no runtime dependency, no environment
 * sniffing. Add a locale by adding a row: `LOCALES` drives the command menu and
 * `stringsFor` drives the rendering, so nothing else has to change.
 *
 * Split the strings honestly:
 *   - what the USER reads goes here;
 *   - what the MODEL reads (tool descriptions, tool result text) stays English,
 *     because the agent is the one being instructed.
 */

export const LOCALES = ["en", "cs"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export interface CardStrings {
	/** Slash command help and the statusline prefix. */
	title: string;
	/** Informational message shown with ctx.ui.notify. */
	ready: string;
	/** Answer of the `/status` subcommand. */
	status: (enabled: boolean) => string;
	/** Ask before a destructive action. */
	confirm: string;
	/** Shown after a successful action. */
	done: string;
	/** README generator command description */
	readmeGenDesc: string;
	/** Shown when /readme-gen hands the request to the agent. */
	agentDelegated: string;
	/** Completion label for the optional free-text argument. */
	extraArgsDesc: string;
	/** Completion description for the optional free-text argument. */
	extraArgsHint: string;
}

const STRINGS: Record<Locale, CardStrings> = {
	en: {
		title: "pi-readme-generator",
		ready: "pi-readme-generator is ready.",
		status: (enabled) => `pi-readme-generator is ${enabled ? "enabled" : "muted"}.`,
		confirm: "Do you really want to continue?",
		done: "Done.",
		readmeGenDesc: "Ask the agent to generate or update README.md (skill-driven)",
		agentDelegated: "README request handed to the agent — follow along in the chat.",
		extraArgsDesc: "extra instructions",
		extraArgsHint: "Free-text instructions forwarded to the agent, e.g. \"in Czech, add badges\"",
	},
	cs: {
		title: "pi-readme-generator",
		ready: "pi-readme-generator je připraven.",
		status: (enabled) => `pi-readme-generator je ${enabled ? "zapnut" : "ztlumen"}.`,
		confirm: "Opravdu chcete pokračovat?",
		done: "Hotovo.",
		readmeGenDesc: "Požádej agenta o vygenerování nebo aktualizaci README.md (řízeno skillem)",
		agentDelegated: "Požadavek na README předán agentovi — sleduj průběh v chatu.",
		extraArgsDesc: "doplňující pokyny",
		extraArgsHint: "Volný text předaný agentovi, např. \"česky, přidej badges\"",
	},
};

/** The table for a locale; anything unknown falls back to the default. */
export function stringsFor(locale: string | undefined): CardStrings {
	return STRINGS[normalizeLocale(locale)];
}

/** Accept the obvious spellings; a typo is English, never a crash. */
export function normalizeLocale(raw: string | undefined): Locale {
	const token = (raw ?? "").trim().toLowerCase();
	if (token === "cs" || token === "cz" || token === "cze") return "cs";
	return DEFAULT_LOCALE;
}
