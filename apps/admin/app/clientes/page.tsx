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
  const [editing, setEditing] = useState<Customer | null>(null);

  useEffect(() => {
    if (user && user.role !== "platformAdmin") router.replace("/");
  }, [user, router]);

  function refresh() {
    apiClient.getAdminCustomers().then(setCustomers);
  }

  useEffect(() => {
    refresh();
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
              <th className="text-left px-4 py-2.5"></th>
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
                <td className="px-4 py-2.5">
                  <button type="button" onClick={() => setEditing(c)} className="text-brand-600 hover:underline text-xs font-medium">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">Nenhum cliente encontrado.</p>}
      </div>

      {editing && (
        <EditCustomerModal
          customer={editing}
          regions={regions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </AdminShell>
  );
}

function EditCustomerModal({
  customer,
  regions,
  onClose,
  onSaved,
}: {
  customer: Customer;
  regions: DeliveryRegion[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer.name);
  const [businessName, setBusinessName] = useState(customer.businessName ?? "");
  const [phone, setPhone] = useState(customer.phone);
  const [regionId, setRegionId] = useState(customer.regionId ?? "");
  const [referenceCode, setReferenceCode] = useState(customer.referenceCode ?? "");
  const [status, setStatus] = useState(customer.status);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await apiClient.updateCustomer(customer.id, {
      name,
      businessName: businessName || undefined,
      phone,
      regionId: regionId || undefined,
      referenceCode: referenceCode || undefined,
      status,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-slate-900 mb-4">Editar cliente</h2>

        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 mb-4 text-sm space-y-2">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">E-mail</span>
            <span className="text-slate-900 text-right">{customer.email}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Tipo</span>
            <span className="text-slate-900">{customer.documentType === "cnpj" ? "Pessoa jurídica" : "Pessoa física"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">{customer.documentType === "cnpj" ? "CNPJ" : "CPF"}</span>
            <span className="text-slate-900 font-mono">{customer.document}</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-1">Endereço{customer.addresses.length > 1 ? "s" : ""}</span>
            {customer.addresses.length === 0 && <p className="text-slate-400 text-xs">Nenhum endereço cadastrado.</p>}
            <ul className="space-y-1">
              {customer.addresses.map((a) => (
                <li key={a.id} className="text-slate-900 text-xs">
                  {a.street}, {a.number}
                  {a.complement && ` - ${a.complement}`} — {a.neighborhood}, {a.city}/{a.state} — {a.zipCode}
                  {a.isDefault && <span className="ml-1 text-brand-600 font-medium">(padrão)</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          {customer.documentType === "cnpj" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Razão social</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Região de entrega</label>
            <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
              <option value="">Fora de zona</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Normalmente é resolvida sozinha pelo bairro do endereço — só troque aqui se precisar corrigir manualmente.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Código de referência</label>
            <input
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Customer["status"])} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="text-sm text-slate-600 px-4 py-2 hover:bg-slate-50 rounded-md">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
