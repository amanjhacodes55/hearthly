import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // STANDALONE=1 (Docker / Render) emits a minimal server bundle: smaller image, faster cold starts.
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  compress: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep visited dashboard pages in the client router cache briefly so back/forth navigation is instant.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  async headers() {
    return [
      // The dashboard must never be framed by other sites (clickjacking); the widget runs in a Shadow DOM, not an iframe.
      { source: "/((?!widget\\.js|widget-preview|api/widget|help|demo).*)", headers: [...securityHeaders, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/widget-preview", headers: [...securityHeaders, { key: "X-Frame-Options", value: "SAMEORIGIN" }] },
      { source: "/(widget\\.js|api/widget/.*|help/.*|demo)", headers: securityHeaders },
      { source: "/widget.js", headers: [{ key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" }, { key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
};
export default nextConfig;
