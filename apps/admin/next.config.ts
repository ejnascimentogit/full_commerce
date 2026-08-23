import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ecommerce/api-client", "@ecommerce/types"],
  async headers() {
    // Mesmo motivo do storefront: painel admin é todo client-side, cachear o
    // HTML no CDN só faz o Cloudflare servir telas antigas depois de um deploy.
    return [
      {
        source: "/:path((?!_next/static|_next/image|favicon.ico).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
