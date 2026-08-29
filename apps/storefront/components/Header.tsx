"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Category } from "@ecommerce/types";
import { CartBadge } from "./CartBadge";
import { AccountMenu } from "./AccountMenu";
import { LogoLink } from "./LogoLink";

export function Header({ categories }: { categories: Category[] }) {
  const router = useRouter();

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q");
    // router.push em vez de submit nativo do form — um <form action> normal
    // recarrega a página inteira, o que reseta a cor de marca (e qualquer outro
    // estado só carregado via JS) para o padrão até o ThemeInjector rodar de novo.
    router.push(q ? `/catalogo?q=${encodeURIComponent(String(q))}` : "/catalogo");
  }

  return (
    <header className="bg-brand-600 text-white">
      <div className="mx-auto max-w-7xl px-4 py-4 flex items-center gap-6">
        <LogoLink />

        <form onSubmit={handleSearch} className="flex-1 max-w-2xl" role="search">
          <input
            type="search"
            name="q"
            placeholder="Pesquisar produtos..."
            className="w-full rounded-md px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </form>

        <div className="flex items-center gap-4 shrink-0">
          <AccountMenu />
          <CartBadge />
        </div>
      </div>

      <nav className="mx-auto max-w-7xl px-4 pb-3 flex items-center gap-5 overflow-x-auto text-sm">
        <Link href="/catalogo" className="flex items-center gap-1.5 font-semibold shrink-0">
          <span aria-hidden>☰</span> Todos os Departamentos
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/catalogo?categoria=${c.slug}`}
            className="shrink-0 text-brand-50 hover:text-white hover:underline underline-offset-4"
          >
            {c.icon ? `${c.icon} ` : ""}
            {c.name}
          </Link>
        ))}
        <Link href="/fornecedores" className="shrink-0 text-brand-50 hover:text-white hover:underline underline-offset-4 ml-auto">
          Fornecedores
        </Link>
        <Link href="/ajuda" className="shrink-0 text-brand-50 hover:text-white hover:underline underline-offset-4">
          ❓ Ajuda
        </Link>
      </nav>
    </header>
  );
}
