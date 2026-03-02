import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "sharp", "canvas"],
  turbopack: {},
};

export default nextConfig;
