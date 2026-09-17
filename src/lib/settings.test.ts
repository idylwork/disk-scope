import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampHighlightIndex,
  HIGHLIGHT_THRESHOLD_STEPS,
  highlightThresholdBytes,
} from "./settings";

test("clampHighlightIndex は範囲外を端に寄せる", () => {
  assert.equal(clampHighlightIndex(-3), 0);
  assert.equal(clampHighlightIndex(1.4), 1);
  assert.equal(clampHighlightIndex(99), HIGHLIGHT_THRESHOLD_STEPS.length - 1);
});

test("highlightThresholdBytes の 0 は強調なし", () => {
  assert.equal(highlightThresholdBytes(0), 0);
  assert.equal(highlightThresholdBytes(1), 1 * 1024 * 1024);
});
