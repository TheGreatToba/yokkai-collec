import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const source = file => readFileSync(resolve(root, file), "utf8");
const compiled = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source("lib/ui/local-profile-style.ts"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText,
  { exports: compiled.exports, module: compiled }
);
const styles = compiled.exports;
const plain = value => JSON.parse(JSON.stringify(value));

test("local style choices offer eight fonts, seven effects and decorative badges only", () => {
  assert.equal(styles.NAME_FONTS.length, 8);
  assert.equal(styles.NAME_EFFECTS.length, 7);
  assert.equal(styles.STYLE_BADGES.length, 6);
  assert.ok(styles.NAME_EFFECTS.some(effect => effect.id === "shimmer"));
  assert.doesNotMatch(
    JSON.stringify(styles.STYLE_BADGES),
    /admin|verified|moderator|achievement|pro-badge/i
  );
  assert.deepEqual(plain(styles.DEFAULT_LOCAL_PROFILE_STYLE.badges), []);
});

test("applied styles reject arbitrary CSS, unknown presets and more than three badges", () => {
  const safe = styles.normalizeLocalProfileStyle({
    font: "url(evil)",
    effect: "unknown",
    color: "url(evil)",
    secondary: "red;display:none",
    badges: ["comet", "comet", "invalid", "bloom", "orbit", "crystal"]
  });
  assert.deepEqual(plain(safe), {
    font: "classic",
    effect: "solid",
    color: "#eeebff",
    secondary: "#b69aff",
    badges: ["comet", "bloom", "orbit"]
  });
  const variables = styles.localNameVariables({
    ...safe,
    font: "modern",
    color: "#ff83bc"
  });
  assert.equal(variables["--name-color"], "#ff83bc");
  assert.match(variables["--name-font"], /font-sora/);
  assert.doesNotMatch(JSON.stringify(variables), /evil|display:none/);
});

test("surprise and reset stay inside the cosmetic catalogue", () => {
  for (const random of [() => 0, () => 0.5, () => 0.999]) {
    const style = styles.randomLocalProfileStyle(random);
    assert.deepEqual(
      plain(styles.normalizeLocalProfileStyle(style)),
      plain(style)
    );
    assert.equal(style.badges.length, 1);
  }
  assert.equal(styles.DEFAULT_LOCAL_PROFILE_STYLE.font, "classic");
  assert.equal(styles.DEFAULT_LOCAL_PROFILE_STYLE.effect, "solid");
});

test("editor has live preview, deliberate apply and no persistence or game writes", () => {
  const ui = source("components/local-profile-style-preview.tsx");
  const context = source("components/local-profile-style-context.tsx");
  assert.match(ui, /if \(!preview \|\| !props.isMe\) return null/);
  assert.match(ui, /Apply locally/);
  assert.match(ui, /onApply\(draft\)/);
  assert.match(ui, /initial=\{preview.style\}/);
  assert.match(ui, /onCancel=\{\(\) => setOpen\(false\)\}/);
  assert.match(ui, /aria-pressed=/);
  assert.match(ui, /draft.badges.length >= 3/);
  assert.match(context, /\| null>\(null\)/);
  for (const code of [ui, context])
    assert.doesNotMatch(
      code,
      /fetch\(|\.rpc\(|localStorage|sessionStorage|stripe|setItem/i
    );
  const css = source("styles/profile-style.css");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none/);
  assert.match(css, /max-width: 720px/);
});
