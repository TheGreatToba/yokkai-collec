import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cardCinematicDocument } from "@/lib/ui/card-cinematic-document";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Type": "text/plain; charset=utf-8"
  };
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404, headers });
  }
  const url = new URL(request.url);
  const rarity = url.searchParams.get("rarity");
  if (rarity !== "SSR") {
    return new Response("Invalid cinematic rarity.", { status: 400, headers });
  }
  try {
    const source = await readFile(
      join(process.cwd(), "data/card-cinematics", "ssr.html"),
      "utf8"
    );
    return new Response(
      cardCinematicDocument(source, url.searchParams, url.origin, rarity),
      { headers }
    );
  } catch {
    return new Response("The cinematic is unavailable.", {
      status: 400,
      headers
    });
  }
}
