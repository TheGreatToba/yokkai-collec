import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = file =>
  readFileSync(new URL("../" + file, import.meta.url), "utf8");
function load(file, overrides = {}) {
  const compiled = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source(file), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true
      }
    }).outputText,
    {
      exports: compiled.exports,
      module: compiled,
      require: id => (id in overrides ? overrides[id] : require(id))
    }
  );
  return compiled.exports;
}
const presets = load("lib/ui/local-profile-style.ts");
const props = { ownerId: "owner", name: "Collector", isMe: true };

test("the style hook refuses Basic application before publishing anything to the shared preview", () => {
  for (const allowed of [false, true]) {
    const applied = [];
    const preview = {
      style: presets.DEFAULT_LOCAL_PROFILE_STYLE,
      apply: (...args) => applied.push(args)
    };
    const context = load("components/local-profile-style-context.tsx", {
      react: { ...React, useContext: () => preview },
      "@/lib/ui/local-profile-style": presets,
      "@/lib/ui/local-player-style-store": {
        localPlayerStyles: {
          publish() {
            assert.fail("The hook must use the provider");
          }
        }
      },
      "@/components/use-local-player-style": {
        useLocalPlayerStyle: () => null
      },
      "@/components/card-customization-access": {
        useCardCustomizationAccess: () => allowed
      }
    });
    context
      .useLocalProfileStyle("owner")
      .apply(presets.DEFAULT_LOCAL_PROFILE_STYLE);
    assert.equal(applied.length, Number(allowed));
    if (allowed) assert.equal(applied[0][1], "owner");
  }
});

function editor(allowed, previewPresent = true) {
  const changes = [],
    applications = [];
  const Button = ({
    children,
    disabled,
    onClick,
    "aria-describedby": description
  }) =>
    React.createElement(
      "button",
      { disabled, onClick, "aria-describedby": description },
      children
    );
  const Modal = () => null;
  const ui = load("components/local-profile-style-preview.tsx", {
    react: {
      ...React,
      useState: initial => [initial, next => changes.push(next)]
    },
    "next/link": { __esModule: true, default: "a" },
    "next/image": { __esModule: true, default: "img" },
    "@/components/ui": { Button, Modal, Avatar: () => null },
    "@/components/local-pro-badge-preview": {
      LocalProProfileBadge: () => null
    },
    "@/components/local-profile-style-context": {
      useLocalProfileStyle: () =>
        previewPresent
          ? {
              style: presets.DEFAULT_LOCAL_PROFILE_STYLE,
              apply: style => applications.push(style)
            }
          : null
    },
    "@/components/card-customization-access": {
      useCardCustomizationAccess: () => allowed,
      PRO_PROFILE_STYLE_MESSAGE:
        "Profile styling is available to Pro members only."
    },
    "@/lib/ui/local-profile-style": presets
  });
  return { ui, Button, Modal, changes, applications };
}

test("Basic has a disabled Style profile button and upgrade notice; forced open/apply handlers do nothing", () => {
  const fixture = editor(false);
  const element = fixture.ui.LocalProfileStyleEditor(props);
  const children = React.Children.toArray(element.props.children);
  const button = children.find(child => child.type === fixture.Button);
  const modal = children.find(child => child.type === fixture.Modal);
  assert.equal(button.props.disabled, true);
  assert.equal(button.props["aria-describedby"], "profile-style-pro-notice");
  button.props.onClick();
  modal.props.children.props.onApply(presets.DEFAULT_LOCAL_PROFILE_STYLE);
  assert.deepEqual(fixture.changes, []);
  assert.deepEqual(fixture.applications, []);
  assert.equal(modal.props.open, false);
  const html = renderToStaticMarkup(element);
  assert.match(html, /Profile styling is available to Pro members only\./);
  assert.match(html, /href="\/premium">Discover Yokkai Pro/);
  assert.doesNotMatch(html, /Preview chat/);
});

test("Pro retains the editor and sharing link; visitors and missing preview contexts never get the control", () => {
  const fixture = editor(true);
  const element = fixture.ui.LocalProfileStyleEditor(props);
  const children = React.Children.toArray(element.props.children);
  children.find(child => child.type === fixture.Button).props.onClick();
  children
    .find(child => child.type === fixture.Modal)
    .props.children.props.onApply(presets.DEFAULT_LOCAL_PROFILE_STYLE);
  assert.deepEqual(fixture.changes, [true, false]);
  assert.equal(fixture.applications.length, 1);
  const html = renderToStaticMarkup(element);
  assert.doesNotMatch(html, /disabled=""|Pro members only/);
  assert.match(html, /profile-style-sharing-preview/);
  assert.equal(
    fixture.ui.LocalProfileStyleEditor({ ...props, isMe: false }),
    null
  );
  assert.equal(editor(true, false).ui.LocalProfileStyleEditor(props), null);
});
