"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiClient } from "@ecommerce/api-client";
import type { Category, Product, Vendor } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

type StatusFilter = "all" | Product["status"];
type PhotoFilter = "all" | "with" | "without";

function hasRealPhoto(product: Product): boolean {
  return product.photos.some((url) => !url.startsWith("data:"));
}

export default function ProdutosPage() {
  const { user } = useAdminAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("all");
  const [vendorFilter, setVendorFilter] = useState("");

  useEffect(() => {
    if (!user) return;
    apiClient.getAdminProducts().then(setProducts);
    apiClient.getCategories().then(setCategories);
    apiClient.getVendors({ includeInactive: true }).then(setVendors);
  }, [user]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (photoFilter === "with" && !hasRealPhoto(p)) return false;
      if (photoFilter === "without" && hasRealPhoto(p)) return false;
      if (vendorFilter && p.vendorId !== vendorFilter) return false;
      return true;
    });
  }, [products, statusFilter, photoFilter, vendorFilter]);

  const STATUS_LABEL: Record<StatusFilter, string> = { all: "Todos", active: "Ativo", inactive: "Inativo", draft: "Rascunho" };

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
        <Link href="/produtos/novo" className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700">
          + Novo produto
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">Status</p>
          <div className="flex gap-1.5">
            {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1.5 rounded-full border ${statusFilter === s ? "bg-brand-50 border-brand-300 text-brand-700" : "border-slate-200 text-slate-600"}`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">Foto</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPhotoFilter("all")}
              className={`text-xs px-2.5 py-1.5 rounded-full border ${photoFilter === "all" ? "bg-brand-50 border-brand-300 text-brand-700" : "border-slate-200 text-slate-600"}`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setPhotoFilter("with")}
              className={`text-xs px-2.5 py-1.5 rounded-full border ${photoFilter === "with" ? "bg-brand-50 border-brand-300 text-brand-700" : "border-slate-200 text-slate-600"}`}
            >
              Com foto
            </button>
            <button
              type="button"
              onClick={() => setPhotoFilter("without")}
              className={`text-xs px-2.5 py-1.5 rounded-full border ${photoFilter === "without" ? "bg-brand-50 border-brand-300 text-brand-700" : "border-slate-200 text-slate-600"}`}
            >
              Sem foto
            </button>
          </div>
        </div>

        {user?.role === "platformAdmin" && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Fornecedor</p>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="border border-slate-300 rounded-md px-2.5 py-1.5 text-xs"
            >
              <option value="">Todos</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-xs text-slate-400 pb-1.5">
          {filtered.length} de {products.length} produtos
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Foto</th>
              <th className="text-left px-4 py-2.5">Produto</th>
              <th className="text-left px-4 py-2.5">Código</th>
              <th className="text-left px-4 py-2.5">Categoria</th>
              {user?.role === "platformAdmin" && <th className="text-left px-4 py-2.5">Fornecedor</th>}
              <th className="text-right px-4 py-2.5">Preço</th>
              <th className="text-right px-4 py-2.5">Estoque</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pode ser data-URI de placeholder ou URL do Storage */}
                  <img src={p.photos[0]} alt={p.name} className="w-10 h-10 rounded object-cover border border-slate-200" />
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{p.name}</td>
                <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-2.5 text-slate-500">{categories.find((c) => c.id === p.categoryId)?.name ?? "—"}</td>
                {user?.role === "platformAdmin" && (
                  <td className="px-4 py-2.5 text-slate-500">{vendors.find((v) => v.id === p.vendorId)?.name ?? "—"}</td>
                )}
                <td className="px-4 py-2.5 text-right">R$ {(p.salePrice ?? p.basePrice).toFixed(2).replace(".", ",")}</td>
                <td className="px-4 py-2.5 text-right">{p.stock}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {p.status === "active" ? "Ativo" : p.status === "draft" ? "Rascunho" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/produtos/${p.id}`} className="text-brand-600 hover:underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">Nenhum produto encontrado com esses filtros.</p>}
      </div>
    </AdminShell>
  );
}
