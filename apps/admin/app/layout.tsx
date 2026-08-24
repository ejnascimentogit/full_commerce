import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "@/lib/admin-auth-context";
import { ThemeInjector } from "@/components/ThemeInjector";

export const metadata: Metadata = {
  title: "Painel Admin | Full-Commerce",
  description: "Painel de gestão do e-commerce.",
};

// Roda antes da primeira pintura da página (bloqueante, no <head>) pra aplicar
// a última paleta de marca conhecida (cache em localStorage, gravado pelo
// ThemeInjector) e evitar o flash do azul padrão — mesmo script do storefront,
// mesma chave/formato, os dois precisam ficar em sincronia.
const THEME_BOOTSTRAP_SCRIPT = `
try {
  var palette = JSON.parse(localStorage.getItem("ecommerce.theme.palette"));
  var root = document.documentElement.style;
  root.setProperty("--color-brand-50", palette["50"]);
  root.setProperty("--color-brand-100", palette["100"]);
  root.setProperty("--color-brand-500", palette["500"]);
  root.setProperty("--color-brand-600", palette["600"]);
  root.setProperty("--color-brand-700", palette["700"]);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="antialiased text-slate-900">
        <ThemeInjector />
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
