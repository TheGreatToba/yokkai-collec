import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function setup() {
  const calls = [];
  const context = {
    exports: {},
    require(name) {
      if (name === "@/utils/supabase/client")
        return {
          createClient: () => ({
            storage: {
              from(bucket) {
                assert.equal(bucket, "avatars");
                return {
                  async upload(path, file, options) {
                    calls.push({ path, size: file.size, options });
                    return { error: null };
                  },
                  getPublicUrl: path => ({
                    data: { publicUrl: `https://storage.test/avatars/${path}` }
                  })
                };
              }
            }
          })
        };
      if (
        [
          "@/lib/data/read-request",
          "@/lib/data/cards",
          "@/lib/data/player-state"
        ].includes(name)
      )
        return {};
      assert.fail(`Unexpected import ${name}`);
    }
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("../lib/data/profile.ts", import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020
        }
      }
    ).outputText,
    context
  );
  return { api: context.exports, calls };
}

for (const [method, kind] of [
  ["uploadAvatar", "avatar"],
  ["uploadBanner", "banner"]
]) {
  test(`${kind} accepts images above the old limit and exactly 4 MB`, async () => {
    const { api, calls } = setup();
    assert.equal(api.PROFILE_IMAGE_MAX_BYTES, 4194304);
    for (const size of [2097153, 3 * 1024 * 1024, 4194304]) {
      const result = await api[method](
        { size, type: "image/png", name: "photo.png" },
        "owner-id"
      );
      assert.match(result, new RegExp(`/owner-id/${kind}\\.png\\?v=\\d+$`));
    }
    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.equal(call.path, `owner-id/${kind}.png`);
      assert.equal(call.options.upsert, true);
      assert.equal(call.options.contentType, "image/png");
    }
  });

  test(`${kind} rejects 4 MB + 1 byte before contacting storage`, async () => {
    const { api, calls } = setup();
    await assert.rejects(
      api[method](
        { size: 4194305, type: "image/png", name: "photo.png" },
        "owner-id"
      ),
      /4 MB or smaller/
    );
    assert.equal(calls.length, 0);
  });

  test(`${kind} keeps JPG, PNG, WebP, GIF and rejects other formats`, async () => {
    const { api, calls } = setup();
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      await api[method](
        { size: 3 * 1024 * 1024, type, name: "photo.png" },
        "owner-id"
      );
    }
    for (const type of ["image/svg+xml", "application/pdf", "text/html", ""]) {
      await assert.rejects(
        api[method]({ size: 1024, type, name: "photo.svg" }, "owner-id"),
        /Use a JPG, PNG, WebP or GIF image/
      );
    }
    assert.equal(calls.length, 4);
  });
}

test("profile editor and previews advertise the new 4 MB limit", () => {
  const read = name =>
    readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), "utf8");
  assert.match(read("profile"), /Up to 4 MB/);
  assert.match(read("profile"), /up to 4 MB/);
  assert.doesNotMatch(read("profile"), /2 Mo|2 MB/);
  assert.match(read("profile-preview"), /file.size > PROFILE_IMAGE_MAX_BYTES/);
  assert.match(read("social-preview"), /Up to 4 MB/);
});
