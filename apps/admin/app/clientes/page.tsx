"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { Customer, DeliveryRegion } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { useRouter } from "next/navigation";

export default function ClientesPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user && user.role !== "platformAdmin") router.replace("/");
  }, [user, router]);

  useEffect(() => {
    apiClient.getAdminCustomers().then(setCustomers);
    apiClient.getRegions({ includeInactive: true }).then(setRegions);
  }, []);

  if (user?.role !== "platformAdmin") return null;

  const term = search.trim().toLowerCase();
  const filtered = term
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term) ||
          c.document.toLowerCase().includes(term) ||
          (c.code ?? "").toLowerCase().includes(term) ||
          (c.referenceCode ?? "").toLowerCase().includes(term),
      )
    : customers;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail, documento ou código..."
          className="border border-slate-300 rounded-md px-3 py-2 text-sm w-80"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Código</th>
              <th className="text-left px-4 py-2.5">Nome</th>
              <th className="text-left px-4 py-2.5">Documento</th>
              <th className="text-left px-4 py-2.5">E-mail</th>
              <th className="text-left px-4 py-2.5">Telefone</th>
              <th className="text-left px-4 py-2.5">Região</th>
              <th className="text-left px-4 py-2.5">Cód. referência</th>
              <th className="text-left px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{c.code ?? "—"}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {c.name}
                  {c.businessName && <span className="block text-xs text-slate-400 font-normal">{c.businessName}</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{c.document}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.email}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.phone}</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {c.regionId ? (regions.find((r) => r.id === c.regionId)?.name ?? "—") : <span className="text-amber-600">Fora de zona</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{c.referenceCode ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">Nenhum cliente encontrado.</p>}
      </div>
    </AdminShell>
  );
}
