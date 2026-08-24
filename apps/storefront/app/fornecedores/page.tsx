"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { Category, Vendor } from "@ecommerce/types";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";

// Vitrine institucional dos fornecedores — só pra credibilidade (mostrar que
// são marcas conhecidas por trás do catálogo), não é navegação de compra.
export default function FornecedoresPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    apiClient.getCategories().then(setCategories);
    apiClient.getVendors().then((all) => setVendors(all.filter((v) => v.logoUrl)));
  }, []);

  return (
    <>
      <RegionBar />
      <Header categories={categories} />

      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">Conheça nossos fornecedores</h1>
        <p className="text-sm text-slate-500 text-center mb-8">Marcas de confiança por trás do nosso catálogo.</p>

        {vendors.length === 0 ? (
          <p className="text-sm text-slate-500 text-center">Nenhum fornecedor com logo cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {vendors.map((v) => (
              <div key={v.id} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded vendor logo */}
                <img src={v.logoUrl} alt={v.name} className="h-16 w-full object-contain" />
                <p className="text-xs font-semibold text-slate-700 text-center">{v.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
