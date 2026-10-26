import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/shared/state.js";

test("state kernel initializes with defaults", () => {
	const st = createInitialState();
	assert.equal(st.enabled, true);
	assert.equal(st.lang, "en", "English is the default locale; /pi-readme-generator lang cs switches it");
	assert.equal(typeof st.lastRunTimestamp, "number");
});
