import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Full-Commerce | Loja B2B",
  description: "Loja por atacado para o seu negócio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased text-slate-900">{children}</body>
    </html>
  );
}
