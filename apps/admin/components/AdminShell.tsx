"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AdminPermissionKey } from "@ecommerce/types";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { useStoreBrand } from "@/lib/use-store-brand";
import { LineStrengthControl } from "@/components/LineStrengthControl";

// Sem domínio próprio ainda (pendência conhecida) — quando tiver, só trocar aqui.
const STOREFRONT_URL = "https://fullcommerce-storefront.ejnascimento1.workers.dev";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  platformOnly?: boolean;
  ownerOnly?: boolean;
  permissionKey?: AdminPermissionKey;
  // Rotas que também deixam o item "ativo" no menu (telas de detalhe que continuam fora da pasta do item).
  alsoActiveOn?: string[];
  // Grupo (menu com sub-menu): o item só abre/fecha os filhos; aparece se pelo menos um filho for permitido.
  children?: NavItem[];
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/produtos", label: "Produtos", icon: "📦", permissionKey: "produtos" },
  {
    href: "/comercial",
    label: "Comercial",
    icon: "💼",
    children: [
      // Vendas = Pedidos + Orçamentos + Perdidos (abas). Sem chave de permissão própria ainda -- reaproveita "pedidos"
      // de propósito (ver .claude/skills/ecommerce/references/orcamento-implementacao.md).
      { href: "/comercial/vendas", label: "Vendas", icon: "🧾", permissionKey: "pedidos", alsoActiveOn: ["/pedidos", "/orcamentos", "/perdidos"] },
      { href: "/comercial/promocoes", label: "Promoções", icon: "🏷️", permissionKey: "promocoes" },
      { href: "/comercial/atividades", label: "Atividades", icon: "📋", platformOnly: true, permissionKey: "atividades" },
      { href: "/comercial/mensagens", label: "Mensagens", icon: "💬", platformOnly: true },
    ],
  },
  { href: "/clientes", label: "Clientes", icon: "👥", platformOnly: true, permissionKey: "clientes" },
  { href: "/financeiro", label: "Financeiro", icon: "💰", platformOnly: true, permissionKey: "financeiro" },
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
  const brand = useStoreBrand("admin");
  // Cada empresa tem a loja no mesmo padrao do admin (<nome>-admin -> <nome>-storefront); fora do padrao usa o endereco fixo.
  const [storefrontUrl, setStorefrontUrl] = useState(STOREFRONT_URL);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const host = window.location.hostname;
    if (host.includes("-admin.")) setStorefrontUrl(`https://${host.replace("-admin.", "-storefront.")}`);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const canSee = (item: NavItem): boolean => {
    if (!user) return false;
    if (item.ownerOnly) return !!user.isPlatformOwner;
    if (user.role === "staff") {
      // Configurações/Empresas nunca são concedíveis a staff, mesmo sem permissionKey.
      if (item.platformOnly && !item.permissionKey) return false;
      if (!item.permissionKey) return true; // Dashboard, Ajuda — sempre visíveis
      return (user.permissions ?? []).includes(item.permissionKey);
    }
    if (item.platformOnly) return user.role === "platformAdmin";
    return true;
  };

  // Grupo sem nenhum filho permitido some; com filhos, o href do grupo vira o do primeiro filho (usado no redirecionamento do staff).
  const visibleNav: NavItem[] = user
    ? NAV.flatMap((item): NavItem[] => {
        if (!item.children) return canSee(item) ? [item] : [];
        const children = item.children.filter(canSee);
        return children.length > 0 ? [{ ...item, href: children[0].href, children }] : [];
      })
    : [];

  const isActive = (item: NavItem) =>
    [item.href, ...(item.alsoActiveOn ?? [])].some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));

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
    // h-screen (não min-h-screen) de propósito: <main> abaixo precisa de uma altura
    // travada pro overflow-auto dele virar um scroll de verdade, em vez de deixar a
    // página inteira crescer e quem rola ser o documento — isso não só fazia o menu
    // lateral rolar junto (sem ninguém notar em telas curtas), como quebrava o
    // "position: sticky" de qualquer coisa dentro do <main> (o navegador só sabe
    // recalcular a posição sticky quando o próprio ancestral com overflow rola).
    <div className="h-screen flex">
      <aside className="w-60 bg-slate-900 text-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-5 text-lg font-bold text-white border-b border-slate-800">
          {brand ? (
            brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={brand.storeName} className="h-10 w-auto max-w-[190px] object-contain rounded" />
            ) : (
              brand.storeName
            )
          ) : (
            <span className="invisible">.</span>
          )}
          <span className="block text-xs font-normal text-slate-400 mt-0.5">Painel Admin</span>
        </div>
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-5 mt-4 flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md py-2"
        >
          🌐 Ver loja
          <span aria-hidden className="text-xs">
            ↗
          </span>
        </a>
        <nav className="flex-1 py-3 mt-2 overflow-y-auto">
          {visibleNav.map((item) => {
            if (item.children) {
              const groupActive = item.children.some(isActive);
              const expanded = openGroups[item.label] ?? groupActive;
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [item.label]: !expanded }))}
                    className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-sm text-left ${groupActive ? "text-white font-medium" : "hover:bg-slate-800/60"}`}
                  >
                    <span aria-hidden>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    <span aria-hidden className="text-xs text-slate-400">
                      {expanded ? "▾" : "▸"}
                    </span>
                  </button>
                  {expanded &&
                    item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2.5 pl-10 pr-5 py-2 text-sm ${isActive(child) ? "bg-slate-800 text-white font-medium border-r-2 border-brand-500" : "text-slate-300 hover:bg-slate-800/60"}`}
                      >
                        <span aria-hidden>{child.icon}</span>
                        {child.label}
                      </Link>
                    ))}
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-5 py-2.5 text-sm ${isActive(item) ? "bg-slate-800 text-white font-medium border-r-2 border-brand-500" : "hover:bg-slate-800/60"}`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <LineStrengthControl />
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
