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
};

export default nextConfig;
