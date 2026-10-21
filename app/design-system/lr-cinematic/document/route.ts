import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { lrCinematicDocument } from "@/lib/ui/lr-cinematic-document";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Type": "text/plain; charset=utf-8"
  };
  // Defense in depth: the proxy also blocks all design-system routes in prod.
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404, headers });
  }
  const url = new URL(request.url);
  try {
    const source = await readFile(
      join(process.cwd(), "data/lr-cinematic/reveal.html"),
      "utf8"
    );
    return new Response(
      lrCinematicDocument(source, url.searchParams, url.origin),
      { headers }
    );
  } catch {
    return new Response("The cinematic preview is unavailable.", {
      status: 400,
      headers
    });
  }
}
