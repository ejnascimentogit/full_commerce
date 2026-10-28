import type { MetadataRoute } from "next";

// Faz a página poder ser instalada na tela inicial do celular (Android e iPhone) e abrir como app, sem barra do navegador.
// O nome aqui é fixo (o manifesto é estático); o nome e a logo da loja de cada empresa continuam aparecendo dentro do app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Full-Commerce",
    short_name: "Loja",
    description: "Loja por atacado para o seu negócio.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7fb",
    theme_color: "#1d4ed8",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
