import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "@/lib/admin-auth-context";

export const metadata: Metadata = {
  title: "Painel Admin | Full-Commerce",
  description: "Painel de gestão do e-commerce.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased text-slate-900">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
