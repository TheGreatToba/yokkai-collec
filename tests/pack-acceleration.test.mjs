import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("pack advance is delegated only to the final iframe player", () => {
  const source = readFileSync("components/boosters.tsx", "utf8");
  const body = source.match(
    /const speedUpSeal = \(\) => \{([\s\S]*?)\n  \};/
  )[1];
  const messages = [];
  const advance = new Function("openingStage", body);
  const stage = {
    current: {
      querySelector: selector => {
        assert.equal(selector, "iframe");
        return {
          contentWindow: { postMessage: (...args) => messages.push(args) }
        };
      }
    }
  };
  advance(stage);
  advance(stage);
  assert.deepEqual(messages, [
    [{ type: "yokkai-booster-next-step" }, "*"],
    [{ type: "yokkai-booster-next-step" }, "*"]
  ]);
  assert.doesNotMatch(body, /onOpen|finishOpening|setOpeningPhase|setTimeout/);
  assert.doesNotMatch(source, /accelerateSeal|updatePlaybackRate/);
});
