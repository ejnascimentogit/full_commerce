import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";

export const metadata: Metadata = {
  title: "Full-Commerce | Loja B2B",
  description: "Loja por atacado para o seu negócio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased text-slate-900">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
