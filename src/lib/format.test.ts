import assert from "node:assert/strict";
import { test } from "node:test";
import { usedPercent } from "./format.ts";

test("usedPercent は全体が 0 なら 0", () => {
  assert.equal(usedPercent(10, 0), 0);
});

test("usedPercent は四捨五入した整数パーセントを返す", () => {
  assert.equal(usedPercent(0, 100), 0);
  assert.equal(usedPercent(50, 100), 50);
  assert.equal(usedPercent(2, 3), 67);
});
