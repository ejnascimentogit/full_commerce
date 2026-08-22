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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
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
