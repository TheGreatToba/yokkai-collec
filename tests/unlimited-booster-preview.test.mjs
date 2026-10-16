import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function demo() {
  const source = readFileSync("components/boosters-preview.tsx", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText;
  const slots = [];
  let cursor = 0;
  const Boosters = Symbol("Boosters"),
    Button = Symbol("Button");
  const jsx = (type, props, key) => ({ type, props, key });
  const context = {
    exports: {},
    Date,
    require: name => {
      if (name === "react/jsx-runtime")
        return { jsx, jsxs: jsx, Fragment: Symbol("Fragment") };
      if (name === "react")
        return {
          useState: initial => {
            const index = cursor++;
            if (!(index in slots))
              slots[index] =
                typeof initial === "function" ? initial() : initial;
            return [
              slots[index],
              value => {
                slots[index] =
                  typeof value === "function" ? value(slots[index]) : value;
              }
            ];
          }
        };
      if (name === "@/components/boosters") return { Boosters };
      if (name === "@/components/ui") return { Button };
      throw Error(`Unexpected dependency in isolated demo: ${name}`);
    }
  };
  vm.runInNewContext(code, context);
  function find(node, type) {
    if (node?.type === type) return node;
    for (const child of [node?.props?.children].flat()) {
      if (child && typeof child === "object") {
        const found = find(child, type);
        if (found) return found;
      }
    }
  }
  return () => {
    cursor = 0;
    const tree = context.exports.BoostersPreview();
    return { packs: find(tree, Boosters), reset: find(tree, Button) };
  };
}

test("both demo packs remain available beyond the normal reserve and daily limit", async () => {
  const render = demo();
  for (const kind of ["regular", "decision"]) {
    for (let count = 0; count < 8; count++) {
      const props = render().packs.props;
      assert.equal(props.status.available, 5);
      assert.equal(props.status.nextPackAt, null);
      assert.equal(props.decisionStatus.available, true);
      const cards = await props.onOpen(kind);
      assert.equal(cards.length, 5);
      assert.ok(cards.some(card => card.rarity === "SSR"));
      assert.ok(cards.some(card => card.rarity === "LR"));
      assert.ok(cards.every(card => ["SSR", "LR"].includes(card.rarity)));
      assert.ok(cards.every(card => card.shiny === false));
      assert.equal(render().packs.props.draw.length, 5);
    }
  }
});

test("reset clears the simulated draw and remounts the opening flow", async () => {
  const render = demo();
  await render().packs.props.onOpen("decision");
  render().packs.props.onReveal(0);
  const before = render();
  assert.equal(before.packs.props.revealed, 1);
  before.reset.props.onClick();
  const after = render();
  assert.equal(after.packs.props.draw.length, 0);
  assert.equal(after.packs.props.revealed, 0);
  assert.notEqual(after.packs.key, before.packs.key);
  assert.equal(after.packs.props.decisionStatus.available, true);
});
