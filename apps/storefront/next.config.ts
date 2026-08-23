import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ecommerce/api-client", "@ecommerce/types"],
  async headers() {
    // Por padrão o Next manda o Cloudflare guardar páginas prerenderizadas por
    // até 1 ano (s-maxage=31536000). Como todo o conteúdo real destas páginas
    // vem de chamadas client-side (auth, carrinho, catálogo), não há ganho em
    // cachear o HTML no CDN — só o risco de servir uma versão antiga depois de
    // cada deploy até o cache expirar sozinho. _next/static fica de fora: são
    // arquivos com hash no nome, sempre seguros de cachear para sempre.
    return [
      {
        source: "/:path((?!_next/static|_next/image|favicon.ico).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
