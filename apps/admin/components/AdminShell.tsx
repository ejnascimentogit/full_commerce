"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AdminPermissionKey } from "@ecommerce/types";
import { useAdminAuth } from "@/lib/admin-auth-context";

// Sem domínio próprio ainda (pendência conhecida) — quando tiver, só trocar aqui.
const STOREFRONT_URL = "https://fullcommerce-storefront.ejnascimento1.workers.dev";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  platformOnly?: boolean;
  ownerOnly?: boolean;
  permissionKey?: AdminPermissionKey;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/produtos", label: "Produtos", icon: "📦", permissionKey: "produtos" },
  { href: "/pedidos", label: "Pedidos", icon: "🧾", permissionKey: "pedidos" },
  { href: "/clientes", label: "Clientes", icon: "👥", platformOnly: true, permissionKey: "clientes" },
  { href: "/financeiro", label: "Financeiro", icon: "💰", platformOnly: true, permissionKey: "financeiro" },
  { href: "/promocoes", label: "Promoções", icon: "🏷️", permissionKey: "promocoes" },
  { href: "/departamentos", label: "Departamentos", icon: "🗂️", platformOnly: true, permissionKey: "departamentos" },
  { href: "/fornecedores", label: "Fornecedores", icon: "🏭", platformOnly: true, permissionKey: "fornecedores" },
  { href: "/configuracoes", label: "Configurações", icon: "⚙️", platformOnly: true },
  { href: "/empresas", label: "Empresas", icon: "🏢", ownerOnly: true },
  { href: "/ajuda", label: "Ajuda", icon: "❓" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const visibleNav = user
    ? NAV.filter((item) => {
        if (item.ownerOnly) return !!user.isPlatformOwner;
        if (user.role === "staff") {
          // Configurações/Empresas nunca são concedíveis a staff, mesmo sem permissionKey.
          if (item.platformOnly && !item.permissionKey) return false;
          if (!item.permissionKey) return true; // Dashboard, Ajuda — sempre visíveis
          return (user.permissions ?? []).includes(item.permissionKey);
        }
        if (item.platformOnly) return user.role === "platformAdmin";
        return true;
      })
    : [];

  // Dashboard mostra faturamento/pedidos da empresa toda — staff sem permissão de
  // "pedidos" não consegue nem carregar essa tela (backend recusa), então manda
  // direto pra primeira seção que a pessoa realmente pode acessar.
  useEffect(() => {
    if (loading || !user || user.role !== "staff" || pathname !== "/") return;
    if (!(user.permissions ?? []).includes("pedidos")) {
      const fallback = visibleNav.find((item) => item.href !== "/")?.href ?? "/ajuda";
      router.replace(fallback);
    }
  }, [loading, user, pathname, router, visibleNav]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-slate-900 text-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-5 text-lg font-bold text-white border-b border-slate-800">
          full<span className="text-brand-500">commerce</span>
          <span className="block text-xs font-normal text-slate-400 mt-0.5">Painel Admin</span>
        </div>
        <a
          href={STOREFRONT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-5 mt-4 flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md py-2"
        >
          🌐 Ver loja
          <span aria-hidden className="text-xs">
            ↗
          </span>
        </a>
        <nav className="flex-1 py-3 mt-2">
          {visibleNav.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-5 py-2.5 text-sm ${active ? "bg-slate-800 text-white font-medium border-r-2 border-brand-500" : "hover:bg-slate-800/60"}`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-slate-800 text-sm">
          <p className="font-medium text-white">{user.name}</p>
          <p className="text-xs text-slate-400 mb-2">
            {user.role === "platformAdmin" ? "Plataforma" : user.role === "staff" ? "Equipe" : "Fornecedor"}
          </p>
          <button type="button" onClick={() => logout()} className="text-slate-400 hover:text-white text-xs">
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
