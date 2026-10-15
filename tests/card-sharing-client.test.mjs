import { normalizeWhitespace } from "./helpers/normalize-whitespace.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = path =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("partage client : consentement explicite, erreurs sûres et URL absolue", async () => {
  const calls = [];
  let failure;
  const context = {
    exports: {},
    URL,
    process: { env: { NEXT_PUBLIC_SITE_URL: "https://yokkai.example" } },
    require: () => ({
      createClient: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: "a".repeat(32), error: failure };
        }
      })
    })
  };
  vm.runInNewContext(
    ts.transpileModule(read("lib/data/card-shares.ts"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText,
    context
  );
  const api = context.exports;
  await api.createCardShare("owned-instance", false);
  assert.equal(calls[0].args.p_show_pseudo, false);
  assert.equal(calls[0].args.p_instance_id, "owned-instance");
  assert.equal(
    api.cardShareUrl("a".repeat(32)),
    `https://yokkai.example/partage/${"a".repeat(32)}`
  );
  assert.throws(() => api.cardShareUrl("bad"));
  failure = { message: "private SQL details" };
  await assert.rejects(api.listCardShares(), /temporarily unavailable/);
  failure = { message: "CARD_SHARE_DAILY_LIMIT" };
  await assert.rejects(
    api.createCardShare("owned-instance", false),
    /10 new links per UTC day/
  );
});

test("reveal : partage uniquement final et animation LR intacte", () => {
  const current = read("components/boosters.tsx");
  const animation = source =>
    source
      .slice(
        source.indexOf("    {!done &&"),
        source.indexOf("    <ol className={`yk-reveal-grid")
      )
      .replaceAll("\r\n", "\n");
  // The video replacement is a separately approved product change, not a
  // relaxation of the sharing contract. Otherwise retain the legacy fingerprint.
  if (
    existsSync(
      new URL("../components/card-drop-cinematic.tsx", import.meta.url)
    )
  ) {
    assert.match(current, /<CardDropCinematic/);
    assert.match(current, /onComplete=\{finishDropVideo\}/);
    const video = read("components/card-drop-cinematic.tsx");
    assert.match(video, /onEnded=\{finish\}/);
    assert.match(video, /onError=\{finish\}/);
    assert.match(video, /<YokaiCard \{\.\.\.card\}/);
  } else {
    assert.equal(
      createHash("sha256").update(animation(current)).digest("hex"),
      "9cead83e7e9322974d64869b01d95badacd8668533503d21d21d41e9d4268634"
    );
  }
  assert.match(
    normalizeWhitespace(current),
    normalizeWhitespace(
      /done&&!choosing&&!lost&&!selecting&&!auctioned\.has\(card\.instanceId\)&&\(card\.rarity==="SSR"\|\|card\.rarity==="LR"\|\|card\.shiny\)/
    )
  );
  const collection = read("components/collection.tsx");
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(/!readOnly&&\(?<MyCardShares/)
  );
  assert.match(
    normalizeWhitespace(collection),
    normalizeWhitespace(/!readOnly&&\(?<CardShareButton/)
  );
});
