import assert from "node:assert/strict";
import test from "node:test";
import { serveWallMedia } from "../lib/server/profile-wall-media.mjs";
const id = "75000000-0000-4000-8000-000000000001";
function client({
  logged = true,
  post = true,
  download = true,
  bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  throwing = false
} = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      getUser: async () => ({
        data: { user: logged ? { id } : null },
        error: null
      })
    },
    from: table => {
      calls.push(table);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: post ? { media_path: `${id}/private.png` } : null,
              error: null
            })
          })
        })
      };
    },
    storage: {
      from: bucket => {
        calls.push(bucket);
        return {
          download: async () => {
            if (throwing) throw Error("private detail");
            return {
              data: download
                ? new Blob([bytes], { type: "image/svg+xml" })
                : null,
              error: null
            };
          }
        };
      }
    }
  };
}
test("wall media uses caller RLS, no-store, safe raster signatures and no public/signed URLs", async () => {
  const c = client(),
    response = await serveWallMedia(id, c);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(c.calls, ["profile_wall_posts", "profile-wall-media"]);
  assert.equal(
    (await serveWallMedia(id, client({ logged: false }))).status,
    401
  );
  const denied = client({ post: false });
  assert.equal((await serveWallMedia(id, denied)).status, 404);
  assert.deepEqual(denied.calls, ["profile_wall_posts"]);
  assert.equal(
    (await serveWallMedia(id, client({ download: false }))).status,
    404,
    "privacy is rechecked at storage download"
  );
  assert.equal((await serveWallMedia("../private", client())).status, 404);
  assert.equal(
    (
      await serveWallMedia(
        id,
        client({ bytes: new TextEncoder().encode('<svg onload="alert(1)">') })
      )
    ).status,
    415,
    "disguised SVG/HTML cannot execute"
  );
  assert.equal(
    (
      await serveWallMedia(
        id,
        client({ bytes: new Uint8Array(6 * 1024 * 1024 + 1) })
      )
    ).status,
    413
  );
  assert.equal(
    (await serveWallMedia(id, client({ throwing: true }))).status,
    503
  );
});
