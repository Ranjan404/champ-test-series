import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // There is a stray package-lock.json in a parent folder; pin the project root here.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: { root: path.join(__dirname) },
  // The JSON data folder is read at runtime with fs, never bundled.
  outputFileTracingExcludes: { "*": ["./data/progress/**"] },
  // The old AI-generated GK/GS page moved to /gk; keep bookmarks working.
  async redirects() {
    return [{ source: "/dashboard/bpsc-tre4", destination: "/gk", permanent: false }];
  },
};

export default nextConfig;
