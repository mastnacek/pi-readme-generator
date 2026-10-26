/**
 * Commands slice for pi-readme-generator.
 *
 * Every string the user reads comes from the string table, so the same source
 * serves every locale. `lang` is a non-terminal subcommand: it opens its own
 * value level (Trailing Space Contract, references/command-completions.md).
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { LOCALES, normalizeLocale, stringsFor, type Locale } from "../../shared/i18n.js";
import type { PluginState } from "../../shared/state.js";

export function registerCommands(pi: ExtensionAPI, state: PluginState): void {
	pi.registerCommand("pi-readme-generator", {
		// The description is user-facing, so it resolves at completion time from
		// the table instead of being frozen into the registration.
		getArgumentCompletions: (prefix: string) => completions(prefix, state.lang),
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const s = stringsFor(state.lang);
			const tokens = args.trim().split(/\s+/).filter(Boolean);
			const sub = (tokens[0] ?? "status").toLowerCase();

			if (sub === "lang") {
				const requested = tokens[1]?.toLowerCase();
				if (!requested || !(LOCALES as readonly string[]).includes(requested)) {
					if (ctx.hasUI) {
						ctx.ui.notify(
							`Usage: /pi-readme-generator lang <${LOCALES.join("|")}>`,
							"warning",
						);
					}
					return;
				}
				state.lang = normalizeLocale(requested);
				if (ctx.hasUI) ctx.ui.notify(`${s.title}: ${state.lang}`, "info");
				return;
			}

			if (!ctx.hasUI) return;
			ctx.ui.notify(s.status(state.enabled), "info");
		},
	});
}

/** `lang ` is non-terminal: it offers the locales, terminal once chosen. */
function completions(prefix: string, lang: Locale): { value: string; label: string; description: string }[] | null {
	const text = prefix.trimStart();
	const head = text.split(/\s+/)[0]?.toLowerCase() ?? "";

	if (head === "lang") {
		const typed = text.slice("lang".length).trim().toLowerCase();
		const rows = LOCALES.map((locale) => ({
			value: `lang ${locale}`,
			label: lang === locale ? `${locale} ✓` : locale,
			description: `pi-readme-generator UI language${lang === locale ? " · ● AKTIVNÍ" : ""}`,
		})).filter((row) => row.value.toLowerCase().startsWith(`lang ${typed}`));
		return rows.length > 0 ? rows : null;
	}

	if (head !== "" && !"lang".startsWith(head)) return null;
	return [{ value: "lang ", label: "lang", description: "Jazyk uživatelského rozhraní" }];
}