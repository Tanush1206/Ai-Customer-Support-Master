import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node:sqlite + unpdf are server-only; keep them out of the bundle.
  serverExternalPackages: ["unpdf"],
  experimental: {
    // Allow larger request bodies for document ingestion (PDF uploads).
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
