import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Each approved asset retains its exact dimensions; unknown logos are rejected.
export function assertBrandLogo(source) {
  const blue = source.includes('src="/assets/brand-logo-blue.png"');
  const name = blue ? "blue" : "chrome";
  const [width, height] = blue ? [1448, 1086] : [1672, 941];
  const png = readFileSync(`public/assets/brand-logo-${name}.png`);
  assert.deepEqual(
    png.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );
  assert.equal(png.readUInt32BE(16), width);
  assert.equal(png.readUInt32BE(20), height);
  if (blue)
    assert.equal(
      createHash("sha256").update(png).digest("hex"),
      "f3db5d151dd146ef34bcb4a31fef32280998f7175a3018c9e4b1bcd044478bce"
    );
  assert.match(
    source,
    new RegExp(
      `src="/assets/brand-logo-${name}\\.png"\\s+alt=""\\s+width=\\{${width}\\}\\s+height=\\{${height}\\}`
    )
  );
  return name;
}
