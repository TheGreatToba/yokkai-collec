import type { NextConfig } from "next";

const supabaseImageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.100.20"],
  poweredByHeader: false,
  images: {
    qualities: [75, 85], // Keep cached fronts' quality-75 requests valid.
    remotePatterns:
      supabaseImageOrigin?.protocol === "https:"
        ? [
            new URL(
              "/storage/v1/object/public/card-images/**",
              supabaseImageOrigin
            )
          ]
        : [],
    maximumRedirects: 0
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb"
    }
  },
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origin = supabase ? new URL(supabase).origin : "";
    const connections = [
      origin,
      origin.replace(/^http/, "ws"),
      "https://api.giphy.com",
      "https://cloudflareinsights.com"
    ].filter(Boolean);
    // Static Next.js pages need inline hydration scripts and inline component styles.
    // Report-Only first: inspect browser violations before a separate enforcing PR.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://static.cloudflareinsights.com https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      `connect-src 'self' ${connections.join(" ")}${isDev ? " ws:" : ""}`,
      // Catalogue sources vary; custom images and share downloads also use HTTPS/blob/data.
      "img-src 'self' https: data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-src https://challenges.cloudflare.com"
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
