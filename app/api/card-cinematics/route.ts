import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  cardCinematicDocument,
  type CinematicRarity
} from "@/lib/ui/card-cinematic-document";

export const runtime = "nodejs";

// Only two immutable, public visual templates. No card/account data is read here.
const assets: Partial<Record<CinematicRarity, Promise<string>>> = {};
function template(rarity: CinematicRarity) {
  if (!assets[rarity]) {
    assets[rarity] = readFile(
      join(
        process.cwd(),
        "data/card-cinematics",
        rarity === "LR" ? "lr.html" : "ssr.html"
      ),
      "utf8"
    ).catch(error => {
      delete assets[rarity];
      throw error;
    });
  }
  return assets[rarity]!;
}

export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  };
  if (request.url.length > 8192) {
    return new Response("Invalid cinematic request.", { status: 400, headers });
  }
  const url = new URL(request.url);
  const rarity = url.searchParams.get("rarity");
  if (rarity !== "SSR" && rarity !== "LR") {
    return new Response("Invalid cinematic rarity.", { status: 400, headers });
  }
  try {
    return new Response(
      cardCinematicDocument(
        await template(rarity),
        url.searchParams,
        url.origin,
        rarity
      ),
      { headers }
    );
  } catch {
    return new Response("The cinematic is unavailable.", {
      status: 400,
      headers
    });
  }
}
