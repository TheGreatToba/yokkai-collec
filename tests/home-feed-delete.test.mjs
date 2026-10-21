import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);

test("Home deletion confirms, prevents double submits, retains failed posts and removes successful ones", async () => {
  const post = {
    id: "my-post",
    text: "A favorite",
    author: { id: "me", name: "Collector", avatarUrl: null },
    createdAt: "2026-10-21T10:00:00Z",
    hasMedia: true,
    gifUrl: null
  };
  const states = [],
    refs = [],
    buttons = [];
  let stateIndex = 0,
    refIndex = 0,
    modal,
    release,
    calls = 0,
    fail = true;
  const component = { exports: {} };
  const mocks = {
    react: {
      ...React,
      useEffect: () => {},
      useState: initial => {
        const i = stateIndex++;
        if (!(i in states)) states[i] = initial;
        return [
          states[i],
          value => {
            states[i] = typeof value === "function" ? value(states[i]) : value;
          }
        ];
      },
      useRef: initial => {
        const i = refIndex++;
        return (refs[i] ??= { current: initial });
      }
    },
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }) =>
        React.createElement("a", props, children)
    },
    "@/components/ui": {
      Avatar: () => null,
      Button: ({ children, variant, ...props }) => {
        void variant;
        buttons.push({ children, ...props });
        return React.createElement("button", props, children);
      },
      Modal: props => {
        modal = props;
        return React.createElement("div", null, props.children);
      }
    },
    "@/components/styled-player-name": { StyledPlayerName: () => null },
    "@/components/profile-wall": { ProfileWall: () => null },
    "@/components/wall-post-interactions": { WallPostInteractions: () => null },
    "@/lib/data/profile-wall": { liveWall: {} },
    "@/lib/data/friend-feed": {},
    "@/styles/friend-feed.css": {}
  };
  const js = ts.transpileModule(
    readFileSync("components/home-friend-feed.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX
      }
    }
  ).outputText;
  vm.runInNewContext(js, {
    Error,
    module: component,
    exports: component.exports,
    require: name => (name in mocks ? mocks[name] : require(name))
  });
  let cleaned;
  const adapter = {
    remove: async id => {
      calls++;
      assert.equal(id, post.id);
      await new Promise(resolve => {
        release = resolve;
      });
      if (fail) throw Error("Please retry deletion");
      return "me/file.png";
    },
    discard: async path => {
      cleaned = path;
    }
  };
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    buttons.length = 0;
    modal = null;
    return renderToStaticMarkup(
      React.createElement(component.exports.HomeFriendFeed, {
        initial: { items: [post], next: null },
        viewer: post.author,
        wallAdapter: adapter
      })
    );
  };
  render();
  assert.equal(modal, null, "no confirmation until explicitly requested");
  states[3] = post; // Open the same confirmation as the post's Delete button.
  render();
  assert.equal(modal.title, "Delete this post?");
  buttons.find(button => button.children === "Cancel").onClick();
  render();
  assert.equal(modal, null);
  assert.equal(calls, 0);
  states[3] = post;
  render();
  const submit = buttons.find(button => button.children === "Delete post");
  submit.onClick();
  submit.onClick();
  assert.equal(calls, 1, "synchronous lock prevents duplicate deletions");
  release();
  await new Promise(resolve => setImmediate(resolve));
  const failed = render();
  assert.match(failed, /Please retry deletion/);
  assert.match(failed, /data-feed-post="my-post"/);
  assert.equal(modal.open, true, "failed confirmation remains retryable");
  fail = false;
  buttons.find(button => button.children === "Delete post").onClick();
  assert.equal(calls, 2);
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.doesNotMatch(render(), /data-feed-post="my-post"/);
  assert.equal(modal, null);
  assert.equal(
    cleaned,
    "me/file.png",
    "only the server-returned owned image is discarded"
  );
});
