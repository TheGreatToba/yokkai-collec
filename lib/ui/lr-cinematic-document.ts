// The supplied prototype stays isolated in a sandboxed, development-only frame.
export function lrCinematicDocument(
  source: string,
  params: URLSearchParams,
  parentOrigin: string
) {
  const escape = (value: string) =>
    value.replace(/[&<>"']/g, character => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character]!;
    });
  let document = source
    .replace('<html lang="fr">', '<html lang="en">')
    .replace(
      'aria-label="Animation de révélation de carte Yokkai"',
      'aria-label="Yokkai legendary card reveal"'
    );
  for (const key of ["name", "category", "license"] as const) {
    const value = params.get(key);
    if (value !== null) {
      if (value.length > 240) throw new Error("Invalid card label");
      document = document.replace(
        new RegExp(`(<div class="${key}">)[^<]*(</div>)`),
        (_, open, close) => `${open}${escape(value)}${close}`
      );
    }
  }
  let artwork = "";
  const image = params.get("image");
  if (image) {
    if (image.length > 4096) throw new Error("Invalid card image");
    const url = new URL(image);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      !(url.protocol === "https:" || (local && url.protocol === "http:"))
    ) {
      throw new Error("Invalid card image");
    }
    const safeUrl = url.href.replace(/[<>"'\\]/g, character =>
      encodeURIComponent(character)
    );
    artwork = `.art{background-image:url("${safeUrl}")!important}`;
  }
  const policy = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: https: http://localhost:* http://127.0.0.1:* http://[::1]:*",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join("; ");
  const origin = JSON.stringify(parentOrigin).replaceAll("<", "\\u003c");
  const pauseBridge = `<script>
    window.addEventListener("message", event => {
      if (event.source !== parent || event.origin !== ${origin}) return;
      if (event.data?.type !== "yokkai-lr-pause" || typeof event.data.paused !== "boolean") return;
      document.documentElement.classList.toggle("preview-paused", event.data.paused);
    });
  </script>`;
  return document
    .replace(
      "<head>",
      `<head><meta http-equiv="Content-Security-Policy" content="${escape(policy)}">`
    )
    .replace(
      "</head>",
      `<style>${artwork}
        .preview-paused *, .preview-paused *::before, .preview-paused *::after {
          animation-play-state:paused!important;
        }
      </style></head>`
    )
    .replace("</body>", `${pauseBridge}</body>`);
}
