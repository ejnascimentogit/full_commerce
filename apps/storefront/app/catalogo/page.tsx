"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@ecommerce/api-client";
import type { Category, Product, Vendor } from "@ecommerce/types";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { ProductCard } from "@/components/ProductCard";

// Client component pelo mesmo motivo de app/page.tsx — dados do mock vivem em
// localStorage, só existem no navegador.
export default function CatalogoPage() {
  return (
    <Suspense>
      <CatalogoContent />
    </Suspense>
  );
}

function CatalogoContent() {
  const searchParams = useSearchParams();
  const categoria = searchParams.get("categoria") ?? undefined;
  const fornecedor = searchParams.get("fornecedor") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    apiClient.getCategories().then(setCategories);
    apiClient.getVendors().then(setVendors);
  }, []);

  const activeCategory = categories.find((c) => c.slug === categoria);

  useEffect(() => {
    apiClient
      .getProducts({ categoryId: activeCategory?.id, vendorId: fornecedor, q, pageSize: 60 })
      .then((r) => {
        setProducts(r.items);
        setTotal(r.total);
      });
  }, [activeCategory?.id, fornecedor, q]);

  return (
    <>
      <RegionBar />
      <Header categories={categories} />

      <div className="mx-auto max-w-7xl px-4 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="space-y-6">
          <div>
            <h2 className="font-semibold text-sm text-slate-900 mb-2">Departamentos</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <Link
                  href="/catalogo"
                  className={`block px-2 py-1 rounded transition-colors ${!activeCategory ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"}`}
                >
                  Todos
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/catalogo?categoria=${c.slug}`}
                    className={`block px-2 py-1 rounded transition-colors ${activeCategory?.id === c.id ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"}`}
                  >
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-sm text-slate-900 mb-2">Fornecedores</h2>
            <ul className="space-y-1 text-sm">
              {vendors.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/catalogo?fornecedor=${v.id}`}
                    className={`block px-2 py-1 rounded transition-colors ${fornecedor === v.id ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"}`}
                  >
                    {v.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main>
          <h1 className="text-lg font-bold text-slate-900 mb-4">
            {activeCategory?.name ?? "Todos os produtos"}{" "}
            <span className="font-normal text-sm text-slate-500">({total})</span>
          </h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {products.length === 0 && (
            <p className="text-slate-500 text-sm">Nenhum produto encontrado com esse filtro.</p>
          )}
        </main>
      </div>
    </>
  );
}
