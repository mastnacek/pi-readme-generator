/**
 * Tests for project state, quality, context, and progress evaluator.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateContext,
  evaluateStatus,
  evaluateQuality,
  evaluateProgress,
  checkTypes,
} from "../src/slices/readme-generator/evaluator.js";

describe("evaluateContext", () => {
  it("detects work context for Domino/LotusScript files", () => {
    const ctx = evaluateContext("D:/projects/my-tool", ["agent.lss"], "LotusScript");
    assert.equal(ctx, "work");
  });

  it("detects work context for LN_REA or enterprise paths", () => {
    const ctx = evaluateContext("D:/01_programovani/LN_REA/export-tool", ["main.rs"], "Rust");
    assert.equal(ctx, "work");
  });

  it("detects work context for ERP or ISDOC dependencies", () => {
    const ctx = evaluateContext("D:/projects/parser", ["main.py"], "Python", { "isdoc-parser": "^1.0" });
    assert.equal(ctx, "work");
  });

  it("defaults to personal for general personal tools", () => {
    const ctx = evaluateContext(
      "D:/01_programovani/rust/project-notes",
      ["src/main.rs"],
      "Rust",
      { eframe: "0.35" },
      "https://github.com/mastnacek/project-notes"
    );
    assert.equal(ctx, "personal");
  });
});

describe("evaluateStatus", () => {
  it("evaluates early commit with no tests as prototype", () => {
    assert.equal(evaluateStatus(1, false), "prototype");
  });

  it("evaluates version 0.1.0 as prototype", () => {
    assert.equal(evaluateStatus(5, false, "0.1.0"), "prototype");
  });

  it("evaluates version 0.3.0 as in-development", () => {
    assert.equal(evaluateStatus(10, true, "0.3.0"), "in-development");
  });

  it("evaluates version 1.0.0 with tests as production", () => {
    assert.equal(evaluateStatus(15, true, "1.0.0"), "production");
  });
});

describe("evaluateQuality", () => {
  it("rates minimal projects as experimental", () => {
    assert.equal(evaluateQuality(0, false, false, false, false, 1), "experimental");
  });

  it("rates typed and tested projects as beta or stable", () => {
    const q = evaluateQuality(2, true, true, true, true, 12);
    assert.equal(q, "stable");
  });

  it("rates comprehensive projects as mature", () => {
    const q = evaluateQuality(5, true, true, true, true, 35);
    assert.equal(q, "mature");
  });
});

describe("evaluateProgress", () => {
  it("rates low commits as initial", () => {
    assert.equal(evaluateProgress(1, "prototype", "experimental"), "initial");
  });

  it("rates production or mature projects as completed", () => {
    assert.equal(evaluateProgress(30, "production", "stable"), "completed");
  });

  it("rates active projects as feature-complete", () => {
    assert.equal(evaluateProgress(20, "active", "stable"), "feature-complete");
  });
});

describe("checkTypes", () => {
  it("identifies Rust, TypeScript, Go as typed languages", () => {
    assert.equal(checkTypes(["main.rs"], "Rust"), true);
    assert.equal(checkTypes(["index.ts"], "TypeScript"), true);
    assert.equal(checkTypes(["main.go"], "Go"), true);
  });

  it("identifies tsconfig or py.typed in untyped language project", () => {
    assert.equal(checkTypes(["py.typed", "main.py"], "Python"), true);
    assert.equal(checkTypes(["main.py"], "Python"), false);
  });
});
