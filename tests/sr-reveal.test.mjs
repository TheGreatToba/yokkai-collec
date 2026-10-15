import { normalizeWhitespace } from "./helpers/normalize-whitespace.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
// Product change approved with Walid in this test-only PR. Keep exactly one
// contract active: the old CSS reveal until the video component is installed.
const videoReveal = existsSync(
  path.join(root, "components/card-drop-cinematic.tsx")
);

test("le reveal SR possede un flash bref et un pulse sans reprendre le burst SSR/LR", () => {
  if (videoReveal) {
    const video = readFileSync(
      path.join(root, "components/card-drop-cinematic.tsx"),
      "utf8"
    );
    const mapping = readFileSync(
      path.join(root, "lib/ui/card-drop-video.ts"),
      "utf8"
    );
    assert.match(mapping, /SR: "\/assets\/drops\/sr-v1\.mp4"/);
    assert.match(video, /<video/);
    assert.match(video, /onEnded=\{finish\}/);
    assert.match(video, /onError=\{finish\}/);
    assert.match(video, /<YokaiCard \{\.\.\.card\}/);
    assert.match(video, /<CardBack/);
    return;
  }
  const source = readFileSync(
    path.join(root, "components/boosters.tsx"),
    "utf8"
  );
  const css = readFileSync(path.join(root, "styles/boosters.css"), "utf8");
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/rarity === "SR" && <div className="yk-sr-flash"/)
  );
  assert.doesNotMatch(
    source,
    /rarity === "SR"[^\n]*yk-(?:ssr|lr)-cinematic-stage/
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /\.yk-reveal-sr \.yk-face-up \{ animation: yk-sr-border-pulse/
    )
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/@keyframes yk-sr-flash/)
  );
});

test("SSR et LR escaladent rayons, particules, shake et duree", () => {
  if (videoReveal) {
    const source = readFileSync(
      path.join(root, "components/boosters.tsx"),
      "utf8"
    );
    const mapping = readFileSync(
      path.join(root, "lib/ui/card-drop-video.ts"),
      "utf8"
    );
    const video = readFileSync(
      path.join(root, "components/card-drop-cinematic.tsx"),
      "utf8"
    );
    const css = readFileSync(
      path.join(root, "styles/card-drop-cinematic.css"),
      "utf8"
    );
    assert.match(mapping, /SSR: "\/assets\/drops\/ssr-v1\.mp4"/);
    assert.match(mapping, /LR: "\/assets\/drops\/lr-v1\.mp4"/);
    assert.match(source, /<CardDropCinematic/);
    assert.match(video, /playsInline/);
    assert.match(video, /muted/);
    assert.match(video, /Skip animation/);
    assert.match(video, /prefers-reduced-motion/);
    assert.match(video, /CSS\.supports/);
    assert.match(css, /mask-composite: exclude/);
    assert.match(css, /-webkit-mask-composite: xor/);
    assert.match(css, /object-fit: contain/);
    assert.match(css, /prefers-reduced-motion/);
    assert.doesNotMatch(source, /className="yk-(?:ssr|lr)-cinematic-stage"/);
    return;
  }
  const source = readFileSync(
    path.join(root, "components/boosters.tsx"),
    "utf8"
  );
  const css = readFileSync(path.join(root, "styles/boosters.css"), "utf8");
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/isLR \? 4400 : isSSR \? 3200/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/className="yk-ssr-cinematic-stage"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/className="yk-lr-cinematic-stage"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/className="yk-ssr-godray"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/className="yk-lr-godray"/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/Array\.from\(\{ length: 36 \}/)
  );
  assert.match(
    normalizeWhitespace(source),
    normalizeWhitespace(/Array\.from\(\{ length: 48 \}/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /\.yk-reveal-ssr \.yk-deck \{ animation: yk-ssr-deck-charge 3\.2s/
    )
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /\.yk-reveal-lr \.yk-deck \{ animation: yk-lr-deck-charge 4\.4s/
    )
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-ssr-cinematic-stage[^}]*pointer-events: none/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(/\.yk-lr-cinematic-stage[^}]*pointer-events: none/)
  );
  assert.match(
    normalizeWhitespace(css),
    normalizeWhitespace(
      /prefers-reduced-motion:[^}]+[\s\S]*\.yk-ssr-cinematic-stage,\.yk-lr-cinematic-stage[^}]+display: none/
    )
  );
});

test("Shiny garde un chatoiement continu sur la carte", () => {
  const css = readFileSync(path.join(root, "styles/cards.css"), "utf8");
  assert.match(css, /\.yk-shiny\.yk-animated \.yk-card-art::after/);
  assert.match(css, /animation: yk-shiny-glint 3\.2s/);
});
