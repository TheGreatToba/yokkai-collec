import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = file =>
  readFileSync(new URL("../" + file, import.meta.url), "utf8");
const profile = source("components/profile.tsx");
const ast = ts.createSourceFile(
  "profile.tsx",
  profile,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
function find(node, predicate) {
  if (predicate(node)) return node;
  return ts.forEachChild(node, child => find(child, predicate));
}
const hasClass = (node, value) =>
  ts.isJsxElement(node) &&
  node.openingElement.attributes.properties.some(
    attr =>
      ts.isJsxAttribute(attr) &&
      attr.name.text === "className" &&
      attr.initializer &&
      ts.isStringLiteral(attr.initializer) &&
      attr.initializer.text.split(" ").includes(value)
  );

test("the profile modal puts personal details on the left and the style editor in a separate column", () => {
  const columns = find(ast, node => hasClass(node, "yk-profile-edit-columns"));
  assert.ok(columns);
  const children = columns.children.filter(
    node => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)
  );
  assert.equal(children.length, 2);
  assert.ok(hasClass(children[0], "yk-profile-edit-details"));
  assert.match(children[0].getText(ast), /Profile photo/);
  assert.match(children[0].getText(ast), /<textarea/);
  assert.match(children[0].getText(ast), /yk-profile-banner-editor/);
  assert.doesNotMatch(children[0].getText(ast), /EmbeddedProfileStyleEditor/);
  assert.ok(ts.isJsxSelfClosingElement(children[1]));
  assert.equal(children[1].tagName.getText(ast), "EmbeddedProfileStyleEditor");
  assert.match(
    profile,
    /editingMode === "profile"\s*\? "yk-profile-edit-modal"\s*: "max-w-4xl"/
  );
});

test("the wider modal and responsive columns are scoped to Edit profile", () => {
  const css = source("styles/profile-style.css");
  assert.match(
    css,
    /\.yk-modal\.yk-profile-edit-modal\s*\{[^}]*width: min\(1480px, calc\(100% - 32px\)\)/
  );
  assert.match(
    css,
    /\.yk-profile-edit-columns\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/
  );
  assert.match(
    css,
    /@media \(min-width: 1100px\)\s*\{\s*\.yk-profile-edit-columns\s*\{[^}]*grid-template-columns: minmax\(0, 0\.85fr\) minmax\(0, 1\.35fr\)/
  );
  assert.match(css, /@media \(min-width: 1100px\) and \(max-width: 1399px\)/);
});
