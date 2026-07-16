import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/pdf/export": [
      "node_modules/playwright-core/.local-browsers/chromium_headless_shell-*/**/*",
    ],
  },
  outputFileTracingExcludes: {
    "/api/pdf/export": [
      "node_modules/playwright-core/.local-browsers/chromium-*/**/*",
      "node_modules/playwright-core/.local-browsers/ffmpeg-*/**/*",
    ],
  },
  async redirects() {
    // Pre-rebuild URLs. Query strings pass through automatically.
    return [
      { source: "/projects/new", destination: "/products/new", permanent: false },
      { source: "/projects/:id", destination: "/products/:id", permanent: false },
      { source: "/projects", destination: "/", permanent: false },
      { source: "/templates", destination: "/products/new?mode=template", permanent: false },
      { source: "/library", destination: "/", permanent: false },
      { source: "/countries", destination: "/", permanent: false },
      { source: "/guide", destination: "/settings", permanent: false },
    ];
  },
};

export default nextConfig;
