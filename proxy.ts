import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";

const maintenancePage = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Maintenance — Yokkai Collec'</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body { min-height: 100%; }
      body {
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        color: #f2f0ff;
        background: radial-gradient(circle at 50% 10%, rgba(82, 68, 181, .25), transparent 42%), #090714;
        font-family: Sora, Inter, ui-sans-serif, system-ui, sans-serif;
      }
      main {
        width: min(100%, 620px);
        padding: clamp(32px, 8vw, 64px);
        text-align: center;
        background: rgba(15, 12, 29, .92);
        border: 1px solid #2e276d;
        border-radius: 24px;
        box-shadow: 0 24px 72px rgba(4, 0, 11, .72), 0 0 36px rgba(82, 68, 181, .18);
      }
      .eyebrow { margin: 0 0 18px; color: #ffcc33; font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 0; font-family: Cinzel, Georgia, serif; font-size: clamp(30px, 7vw, 48px); line-height: 1.12; letter-spacing: .03em; }
      p { margin: 22px auto 0; max-width: 46ch; color: #a29dbe; font-size: clamp(15px, 3vw, 18px); line-height: 1.65; }
      .mark { display: inline-grid; width: 52px; height: 52px; margin-bottom: 24px; place-items: center; color: #ffb700; border: 1px solid rgba(255, 183, 0, .45); border-radius: 50%; box-shadow: 0 0 24px rgba(255, 183, 0, .18); font: 700 22px/1 Cinzel, Georgia, serif; }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true">Y</div>
      <p class="eyebrow">Maintenance en cours</p>
      <h1>Yokkai Collec' est en maintenance</h1>
      <p>On prépare une grosse mise à jour. On revient très vite&nbsp;!</p>
    </main>
  </body>
</html>`;

export async function proxy(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE === "true") {
    return new Response(maintenancePage, {
      status: 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "3600",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
