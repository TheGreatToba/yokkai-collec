import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../hooks/use-sfx.ts", import.meta.url), "utf8");

test("les effets mobiles utilisent une session ambient sans interrompre l'audio externe", () => {
  assert.match(source, /session\.type = "ambient"/);
  assert.match(source, /if \(!mobile\) return true/);
  assert.match(source, /if \(!session\) return false/);
  assert.match(source, /!enabled \|\| !allowNonInterruptingAudio\(\)/);
});
