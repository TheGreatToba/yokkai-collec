import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://yokkai-collec.com";
  return ["/", "/connexion", "/inscription"].map(route => ({
    url: new URL(route, origin).href
  }));
}
