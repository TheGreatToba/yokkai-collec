import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { jsx, jsxs } from "react/jsx-runtime";

const read = file =>
  readFileSync(new URL("../" + file, import.meta.url), "utf8");
const compile = source =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
function marketWith(error) {
  const target = { exports: {} };
  vm.runInNewContext(compile(read("lib/data/market.ts")), {
    module: target,
    exports: target.exports,
    Error,
    require: name =>
      name === "@/utils/supabase/client"
        ? { createClient: () => ({ rpc: async () => ({ error }) }) }
        : {}
  });
  return target.exports;
}
const source = read("components/community-views.tsx");
const ast = ts.createSourceFile(
  "chat.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
const component = ast.statements
  .find(s => ts.isFunctionDeclaration(s) && s.name?.text === "AuctionChatPanel")
  .getText(ast);
function panel(adapter) {
  let index = 0,
    now = 100000,
    tree;
  const slots = [],
    effects = [],
    timers = new Map();
  let timerId = 0;
  const hook = value => {
    const key = index++;
    return (slots[key] ??= typeof value === "function" ? value() : value);
  };
  const useState = value => {
    const key = index;
    hook(value);
    return [
      slots[key],
      next => {
        slots[key] = typeof next === "function" ? next(slots[key]) : next;
      }
    ];
  };
  const useRef = value => hook({ current: value });
  const useEffect = (callback, deps) => {
    const key = index++;
    const previous = slots[key];
    if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
      slots[key] = { deps };
      effects.push(() => {
        previous?.cleanup?.();
        slots[key].cleanup = callback();
      });
    }
  };
  const target = { exports: {} };
  vm.runInNewContext(compile(component), {
    module: target,
    exports: target.exports,
    Error,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    Math,
    useState,
    useRef,
    useEffect,
    useMemo: fn => fn(),
    useCallback: fn => fn(),
    liveAuctionChat: adapter,
    Avatar: "avatar",
    PlayerModeration: "moderation",
    GifPicker: "gif-picker",
    Button: "button",
    Link: "a",
    document: { visibilityState: "visible", getElementById: () => null },
    HTMLTextAreaElement: class {},
    window: {
      requestAnimationFrame: fn => {
        effects.push(fn);
        return 1;
      },
      cancelAnimationFrame: () => {},
      setInterval: (fn, ms) => {
        const id = ++timerId;
        timers.set(id, { fn, ms });
        return id;
      },
      clearInterval: id => timers.delete(id)
    },
    require: () => ({ jsx, jsxs })
  });
  const render = () => {
    index = 0;
    tree = target.exports.AuctionChatPanel({
      auctionId: "auction",
      refreshKey: 0,
      finished: false,
      adapter
    });
    while (effects.length) effects.shift()();
    return tree;
  };
  const flush = async () => {
    await new Promise(resolve => setImmediate(resolve));
    return render();
  };
  const nodes = root =>
    root && typeof root === "object"
      ? [
          root,
          ...[root.props?.children]
            .flat(Infinity)
            .flatMap(child => nodes(child))
        ]
      : [];
  const find = predicate => nodes(tree).find(predicate);
  const textarea = () => find(n => n.type === "textarea");
  const button = () =>
    find(n => n.type === "button" && n.props.type === "submit");
  const alert = () => find(n => n.props?.role === "alert");
  const status = () => find(n => n.props?.role === "status");
  render();
  return {
    flush,
    render,
    textarea,
    button,
    alert,
    status,
    write: text => {
      textarea().props.onChange({ target: { value: text } });
      render();
    },
    submit: () =>
      find(n => n.type === "form").props.onSubmit({ preventDefault() {} }),
    enter: () =>
      textarea().props.onKeyDown({
        key: "Enter",
        shiftKey: false,
        nativeEvent: { isComposing: false },
        preventDefault() {}
      }),
    advance: async ms => {
      now += ms;
      for (const timer of [...timers.values()]) timer.fn();
      return flush();
    },
    gif: () => find(n => n.type === "gif-picker"),
    intervals: () => [...timers.values()].map(t => t.ms)
  };
}
const chat = { canPost: true, participants: [], messages: [] };

test("CHAT_RATE_LIMITED : détails RPC, brouillon, décompte et polling réel du composant", async () => {
  const market = marketWith({ message: "CHAT_RATE_LIMITED", details: "5" });
  let calls = 0,
    reads = 0;
  const ui = panel({
    get: async () => {
      reads++;
      return chat;
    },
    send: async (...args) => {
      calls++;
      return market.sendAuctionChatMessage(...args);
    }
  });
  await ui.flush();
  ui.write("Mon brouillon à conserver");
  ui.submit();
  await ui.flush();
  await ui.flush();
  assert.equal(calls, 1);
  assert.equal(ui.textarea().props.value, "Mon brouillon à conserver");
  assert.equal(ui.textarea().props.disabled, false);
  assert.equal(ui.button().props.disabled, true);
  assert.equal(ui.button().props.children, "Réessaie dans 5 s");
  assert.ok(ui.status().props.children.join("").includes("Doucement"));
  assert.equal(ui.gif().props.disabled, true);
  assert.ok(ui.intervals().includes(3000));
  ui.enter();
  await ui.flush();
  assert.equal(calls, 1, "Enter also respects cooldown");
  await ui.advance(3000);
  assert.ok(reads >= 2);
  assert.equal(ui.button().props.children, "Réessaie dans 2 s");
  assert.equal(ui.textarea().props.value, "Mon brouillon à conserver");
  await ui.advance(2000);
  assert.equal(ui.button().props.disabled, false);
  assert.equal(ui.status(), undefined);
});

test("plafond de mentions : texte clair, erreur persistante après polling, brouillon intact", async () => {
  const market = marketWith({
    message: "CHAT_MENTION_INVALID",
    details: "max_mentions=3"
  });
  const ui = panel({
    get: async () => chat,
    send: market.sendAuctionChatMessage
  });
  await ui.flush();
  ui.write("@Alice @Bob @Charlie @Diane");
  ui.submit();
  await ui.flush();
  await ui.flush();
  assert.equal(
    ui.alert().props.children,
    "Tu peux mentionner au maximum 3 personnes différentes par message."
  );
  await ui.advance(3000);
  assert.equal(ui.textarea().props.value, "@Alice @Bob @Charlie @Diane");
  assert.ok(ui.alert());
  assert.equal(ui.button().props.disabled, false);
});

test("succès : texte effacé après confirmation seulement, GIF conserve le brouillon", async () => {
  const sent = {
    id: "id",
    userId: "me",
    pseudo: "Moi",
    message: "envoyé",
    createdAt: new Date().toISOString(),
    mine: true
  };
  const ui = panel({ get: async () => chat, send: async () => sent });
  await ui.flush();
  ui.write("Bonjour");
  ui.submit();
  await ui.flush();
  await ui.flush();
  assert.equal(ui.textarea().props.value, "");
  assert.equal(ui.button().props.children, "Réessaie dans 3 s");
  await ui.advance(3000);
  ui.write("Texte pour plus tard");
  ui.gif().props.onSelect({ url: "https://media.giphy.com/test.gif" });
  await ui.flush();
  await ui.flush();
  assert.equal(ui.textarea().props.value, "Texte pour plus tard");
});
