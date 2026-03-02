import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers"],
  webpack: (config) => {
    config.externals.push({ sharp: "commonjs sharp", canvas: "commonjs canvas" });
    return config;
  },
};

export default nextConfig;
