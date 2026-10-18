import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("accelerating the seal preserves its remaining animation instead of resolving immediately", () => {
  const source = readFileSync("components/boosters.tsx", "utf8");
  const body = source.match(
    /accelerateSeal.current = \(\) => \{([\s\S]*?)\n        \};/
  )[1];
  const calls = [];
  const ref = { current: null };
  const accelerate = new Function(
    "accelerateSeal",
    "reducedMotion",
    "openingStage",
    "window",
    "performance",
    "startedAt",
    "duration",
    "finish",
    "timer",
    body
  );
  const stage = {
    current: {
      getAnimations: () => [
        { updatePlaybackRate: rate => calls.push(["rate", rate]) }
      ]
    }
  };
  const timers = {
    clearTimeout: id => calls.push(["clear", id]),
    setTimeout: (callback, delay) => calls.push(["timer", delay])
  };
  accelerate(
    ref,
    false,
    stage,
    timers,
    { now: () => 300 },
    100,
    800,
    () => assert.fail("must not skip"),
    7
  );
  assert.deepEqual(calls, [
    ["rate", 3],
    ["clear", 7],
    ["timer", 200]
  ]);
  calls.length = 0;
  accelerate(
    ref,
    true,
    stage,
    timers,
    { now: () => 300 },
    100,
    800,
    () => assert.fail("must not skip"),
    7
  );
  assert.deepEqual(calls, []);
});
