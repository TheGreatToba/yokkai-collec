import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

test("shared pack countdown rounds up and clamps expired or full reserves", () => {
  const loaded = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync("lib/ui/pack-countdown.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS }
    }).outputText,
    { exports: loaded.exports }
  );
  const { packCountdown } = loaded.exports;
  assert.equal(packCountdown(61001, 0), "01:02");
  assert.equal(packCountdown(61000, 0), "01:01");
  assert.equal(packCountdown(1000, 2000), "00:00");
  assert.equal(packCountdown(null, 2000), "00:00");
});
