import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile(
  "home-friend-feed.tsx",
  readFileSync("components/home-friend-feed.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
function withClass(node, name) {
  return (
    ts.isJsxElement(node) &&
    node.openingElement.attributes.properties.some(
      prop =>
        ts.isJsxAttribute(prop) &&
        prop.name.getText(source) === "className" &&
        prop.initializer &&
        ts.isStringLiteral(prop.initializer) &&
        prop.initializer.text === name
    )
  );
}
function find(node, predicate) {
  if (predicate(node)) return node;
  return ts.forEachChild(node, child => find(child, predicate));
}
const timeline = find(source, node => withClass(node, "yk-feed-timeline"));
const footer = find(source, node => withClass(node, "yk-feed-footer"));

test("feed footer stays outside the scrolling timeline and inside the same feed block", () => {
  assert.ok(timeline);
  assert.ok(footer);
  assert.equal(footer.openingElement.tagName.getText(source), "footer");
  assert.equal(footer.parent, timeline.parent);
  assert.ok(footer.pos > timeline.end);
  assert.equal(
    find(timeline, node => withClass(node, "yk-feed-footer")),
    undefined
  );
  assert.match(footer.getText(source), /Your circle\. Your stories\./);
});

test("older posts action and end-of-feed status stay at the bottom inside the scroll region", () => {
  const more = find(timeline, node => withClass(node, "yk-feed-more"));
  const end = find(timeline, node => withClass(node, "yk-feed-end"));
  const post = find(timeline, node => withClass(node, "yk-feed-post"));
  assert.ok(more);
  assert.ok(end);
  assert.ok(post);
  assert.ok(more.pos > post.end);
  assert.ok(end.pos > more.end);
  assert.match(more.getText(source), /Load older posts/);
  assert.match(more.getText(source), /onClick=\{\(\) => void more\(\)\}/);
  assert.match(more.getText(source), /disabled=\{busy\}/);
  assert.doesNotMatch(footer.getText(source), /Load older posts|more\(/);
});

test("the bounded timeline scrolls independently and the footer has its own non-overlay surface", () => {
  const css = readFileSync("styles/friend-feed.css", "utf8");
  const timelineRule = css.match(/\.yk-feed-timeline\s*\{([^}]+)\}/)?.[1];
  const footerRule = css.match(/\.yk-feed-footer\s*\{([^}]+)\}/)?.[1];
  assert.ok(timelineRule);
  assert.ok(footerRule);
  assert.match(timelineRule, /max-height:\s*680px/);
  assert.match(timelineRule, /overflow-y:\s*auto/);
  assert.match(timelineRule, /padding-bottom:\s*12px/);
  assert.match(footerRule, /min-height:\s*60px/);
  assert.match(footerRule, /border-top:\s*1px solid/);
  assert.match(footerRule, /background:\s*linear-gradient\(/);
  assert.doesNotMatch(footerRule, /position:\s*(?:absolute|fixed|sticky)/);
});

test("posts form one horizontal row with bounded individually readable cards", () => {
  const css = readFileSync("styles/friend-feed.css", "utf8");
  const strip = css.match(/\.yk-feed-timeline\s*\{([^}]+)\}/)[1];
  const post = css.match(/\.yk-feed-post\s*\{([^}]+)\}/)[1];
  assert.match(strip, /display:\s*flex/);
  assert.match(strip, /overflow-x:\s*auto/);
  assert.match(post, /flex:\s*0 0 min\(380px, 90%\)/);
  assert.match(post, /max-height:\s*420px/);
  assert.match(post, /overflow-y:\s*auto/);
  assert.match(post, /overscroll-behavior-y:\s*contain/);
});
