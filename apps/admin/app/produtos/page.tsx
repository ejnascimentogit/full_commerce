"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@ecommerce/api-client";
import type { Category, Product, Vendor } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function ProdutosPage() {
  const { user } = useAdminAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    if (!user) return;
    const vendorId = user.role === "vendorAdmin" ? user.vendorId : undefined;
    apiClient.getProducts({ vendorId, pageSize: 200 }).then((r) => setProducts(r.items));
    apiClient.getCategories().then(setCategories);
    apiClient.getVendors().then(setVendors);
  }, [user]);

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
        <Link href="/produtos/novo" className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700">
          + Novo produto
        </Link>
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
            {products.map((p) => (
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
        {products.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">Nenhum produto cadastrado.</p>}
      </div>
    </AdminShell>
  );
}
