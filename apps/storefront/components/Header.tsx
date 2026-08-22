import Link from "next/link";
import type { Category } from "@ecommerce/types";
import { CartBadge } from "./CartBadge";

export function Header({ categories }: { categories: Category[] }) {
  return (
    <header className="bg-brand-600 text-white">
      <div className="mx-auto max-w-7xl px-4 py-4 flex items-center gap-6">
        <Link href="/" className="text-2xl font-bold tracking-tight shrink-0">
          full<span className="text-brand-100">commerce</span>
        </Link>

        <form action="/catalogo" method="get" className="flex-1 max-w-2xl" role="search">
          <input
            type="search"
            name="q"
            placeholder="Pesquisar produtos..."
            className="w-full rounded-md px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </form>

        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/conta"
            className="bg-white text-brand-700 font-semibold rounded-md px-4 py-2 text-sm text-center leading-tight hover:bg-brand-50"
          >
            Cadastre-se
            <span className="block font-normal text-xs text-slate-500">Ou faça Login</span>
          </Link>
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
      </nav>
    </header>
  );
}
