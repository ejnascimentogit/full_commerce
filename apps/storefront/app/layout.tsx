import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeInjector } from "@/components/ThemeInjector";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Full-Commerce | Loja B2B",
  description: "Loja por atacado para o seu negócio.",
};

// Roda antes da primeira pintura da página (bloqueante, no <head>) pra aplicar
// a última paleta de marca conhecida (cache em localStorage, gravado pelo
// ThemeInjector) e evitar o flash do azul padrão até o ThemeInjector (client
// component, roda depois do hidrate) confirmar com a API — mesma chave/formato
// que ThemeInjector.tsx usa, os dois precisam ficar em sincronia.
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
      <body className="antialiased text-slate-900 min-h-screen flex flex-col">
        <ThemeInjector />
        <AuthProvider>
          <CartProvider>
            <div className="flex-1">{children}</div>
            <Footer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
