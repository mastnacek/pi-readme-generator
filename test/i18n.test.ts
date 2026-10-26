import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOCALE, LOCALES, normalizeLocale, stringsFor } from "../src/shared/i18n.js";

test("every locale has a complete string table", () => {
	for (const locale of LOCALES) {
		const s = stringsFor(locale);
		for (const key of ["title", "ready", "confirm", "done"] as const) {
			assert.equal(typeof s[key], "string", `${locale}.${key} must be a string`);
			assert.ok(s[key].trim().length > 0, `${locale}.${key} must not be empty`);
		}
		assert.equal(typeof s.status(true), "string");
	}
});

test("an unknown locale is English, never a crash", () => {
	assert.equal(normalizeLocale("klingon"), "en");
	assert.equal(normalizeLocale(undefined), "en");
	assert.equal(stringsFor("nonsense").title, stringsFor("en").title);
});
test("the default locale is the one the scaffold ships", () => {
	assert.equal(stringsFor(DEFAULT_LOCALE).title, "pi-readme-generator");
	assert.equal(DEFAULT_LOCALE, "en");
});
