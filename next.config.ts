import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: "/aarogya",
  assetPrefix: "/aarogya/",
};

export default nextConfig;