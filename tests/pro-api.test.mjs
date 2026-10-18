import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { configureProEntitlements } from "../scripts/configure-pro-entitlements.mjs";

const require = createRequire(import.meta.url),
  root = resolve(import.meta.dirname, "..");
function setup({
  active = false,
  user = { id: "6c000000-0000-4000-8000-000000000001" },
  rpcError = null
} = {}) {
  const calls = [],
    cache = new Map();
  const db = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: active, error: rpcError };
    },
    from(table) {
      return {
        async insert(value) {
          calls.push({ table, value });
          return { error: null };
        },
        async upsert(value) {
          calls.push({ table, value });
          return { error: null };
        }
      };
    },
    storage: {
      from() {
        return {
          getPublicUrl: path => ({
            data: {
              publicUrl: `http://localhost:54321/storage/v1/object/public/avatars/${path}`
            }
          }),
          async upload(path, bytes, options) {
            calls.push({ path, bytes, options });
            return { error: null };
          }
        };
      }
    }
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const compiled = { exports: {} };
    cache.set(file, compiled.exports);
    vm.runInNewContext(
      ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022
        }
      }).outputText,
      {
        module: compiled,
        exports: compiled.exports,
        Buffer,
        Error,
        URL,
        Response,
        Request,
        File,
        FormData,
        process: {
          env: {
            NODE_ENV: "development",
            NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
            SUPABASE_SECRET_KEY: "fixture-only"
          }
        },
        require(id) {
          if (id === "server-only") return {};
          if (id === "@supabase/supabase-js") return { createClient: () => db };
          if (id === "@/utils/supabase/config")
            return {
              getSupabaseConfig: () => ({ url: "http://localhost:54321" })
            };
          if (id === "@/lib/auth/session")
            return { getCurrentUser: async () => user };
          if (id.startsWith("@/")) return load(id.slice(2) + ".ts");
          return require(id);
        }
      }
    );
    return compiled.exports;
  }
  return { load, calls };
}
const jsonRequest = value =>
  new Request("http://localhost:3000/api/pro/profile-style", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(value)
  });
const imageRequest = (
  purpose = "avatar",
  name = "disguised.jpg",
  mime = "image/jpeg",
  extra = false
) => {
  const form = new FormData();
  form.set("purpose", purpose);
  const bytes = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    "base64"
  );
  form.set("file", new File([bytes], name, { type: mime }));
  if (extra) form.set("userId", "someone-else");
  return new Request("http://localhost:3000/api/profile-media", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
    body: form
  });
};
test("Pro API authenticates self, rejects CSRF and never trusts forged paid/user flags", async () => {
  const anonymous = setup({ user: null });
  assert.equal(
    (
      await anonymous
        .load("app/api/pro/benefits/route.ts")
        .GET(new Request("http://localhost:3000/api/pro/benefits"))
    ).status,
    401
  );
  assert.equal(anonymous.calls.length, 0);
  const basic = setup(),
    route = basic.load("app/api/pro/profile-style/route.ts");
  assert.equal(
    (
      await route.POST(
        new Request("http://localhost:3000/api/pro/profile-style", {
          method: "POST",
          headers: { origin: "https://evil.test" },
          body: "{}"
        })
      )
    ).status,
    403
  );
  assert.equal(
    (await route.POST(jsonRequest({ style: { effect: "neon" }, isPro: true })))
      .status,
    400
  );
  assert.equal(
    (await route.POST(jsonRequest({ style: { effect: "neon" } }))).status,
    403
  );
  assert.ok(basic.calls.every(call => call.table !== "profile_customizations"));
  const paid = setup({ active: true }),
    response = await paid
      .load("app/api/pro/profile-style/route.ts")
      .POST(jsonRequest({ style: { effect: "neon" } }));
  assert.equal(response.status, 200);
  assert.equal(
    paid.calls.find(call => call.table === "profile_customizations").value
      .user_id,
    "6c000000-0000-4000-8000-000000000001"
  );
  const failed = setup({ rpcError: { message: "private provider secret" } });
  const unavailable = await failed
    .load("app/api/pro/benefits/route.ts")
    .GET(new Request("http://localhost:3000/api/pro/benefits"));
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /private provider secret/);
});
test("image upload checks actual GIF bytes despite forged JPEG filename/MIME and derives immutable ownership", async () => {
  const basic = setup(),
    route = basic.load("app/api/profile-media/route.ts");
  assert.equal((await route.POST(imageRequest())).status, 403);
  assert.equal((await route.POST(imageRequest("banner"))).status, 403);
  assert.equal(
    (await route.POST(imageRequest("avatar", "x.gif", "image/gif", true)))
      .status,
    400
  );
  assert.ok(basic.calls.every(call => !call.path && !call.table));
  const paid = setup({ active: true });
  const response = await paid
    .load("app/api/profile-media/route.ts")
    .POST(imageRequest());
  assert.equal(response.status, 200);
  const upload = paid.calls.find(call => call.path);
  assert.match(
    upload.path,
    /^6c000000-0000-4000-8000-000000000001\/avatar-[a-f0-9-]+\.gif$/
  );
  assert.equal(upload.options.upsert, false);
  assert.equal(upload.options.contentType, "image/gif");
  assert.equal(
    paid.calls.find(call => call.table === "profile_media_assets").value
      .animated,
    true
  );
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
test("image inspector identifies APNG and animated WebP and rejects HTML/SVG/truncated content", () => {
  const { inspectProfileImage } = setup().load("lib/pro/image.ts");
  const chunk = (type, data) => {
    const b = Buffer.alloc(data.length + 12);
    b.writeUInt32BE(data.length);
    b.write(type, 4);
    data.copy(b, 8);
    return b;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1);
  header.writeUInt32BE(1, 4);
  const png = animated =>
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      ...(animated ? [chunk("acTL", Buffer.alloc(8))] : []),
      chunk("IEND", Buffer.alloc(0))
    ]);
  assert.equal(inspectProfileImage(png(false)).animated, false);
  assert.equal(inspectProfileImage(png(true)).animated, true);
  const body = Buffer.alloc(18);
  body.write("VP8X");
  body.writeUInt32LE(10, 4);
  body[8] = 2;
  const frame = Buffer.alloc(10);
  frame.write("ANMF");
  frame.writeUInt32LE(2, 4);
  const webp = Buffer.concat([Buffer.from("RIFF0000WEBP"), body, frame]);
  webp.writeUInt32LE(webp.length - 8, 4);
  assert.equal(inspectProfileImage(webp).animated, true);
  for (const input of [
    Buffer.from("<svg>not an image</svg>"),
    Buffer.from("<html>not an image</html>"),
    png(false).subarray(0, 20),
    Buffer.alloc(4194305)
  ])
    assert.throws(() => inspectProfileImage(input), /PROFILE_IMAGE_INVALID/);
});
test("operator setup validates provider before enabling the exact scope and fails closed", async () => {
  const env = {
    STRIPE_BILLING_MODE: "test",
    STRIPE_ACCOUNT_ID: "acct_fixture",
    STRIPE_PRO_PRICE_ID: "price_fixture",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SECRET_KEY: "fixture-only"
  };
  const calls = [];
  const dependencies = {
    checkTest: async () => {
      calls.push("provider");
    },
    createClient: () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { error: null };
      }
    })
  };
  assert.equal(
    (await configureProEntitlements(env, true, dependencies)).benefitsEnabled,
    true
  );
  assert.equal(calls[0], "provider");
  assert.deepEqual(calls[1], {
    name: "billing_set_entitlement_scope",
    args: { p_scope: "test:acct_fixture:price_fixture", p_enabled: true }
  });
  await assert.rejects(
    configureProEntitlements(
      { ...env, NEXT_PUBLIC_SUPABASE_URL: "https://api.yokkai-collec.com" },
      true,
      dependencies
    ),
    /CONFIGURATION_INVALID/
  );
  await assert.rejects(
    configureProEntitlements(env, true, {
      ...dependencies,
      checkTest: async () => {
        throw Error("STRIPE_SANDBOX_ACCOUNT_MISMATCH");
      }
    }),
    /ACCOUNT_MISMATCH/
  );
  assert.equal(calls.length, 2);
});
