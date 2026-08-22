import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ecommerce/api-client", "@ecommerce/types"],
};

export default nextConfig;
