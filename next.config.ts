import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/pdf/export": ["node_modules/playwright-core/.local-browsers/**/*"],
  },
};

export default nextConfig;
