"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { Company } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function EmpresasPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (user && !user.isPlatformOwner) router.replace("/");
  }, [user, router]);

  function refresh() {
    apiClient.getCompanies().then(setCompanies);
  }

  useEffect(refresh, []);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await apiClient.createCompany({ name, slug });
    setName("");
    setSlug("");
    setShowForm(false);
    setSubmitting(false);
    refresh();
  }

  if (!user?.isPlatformOwner) return null;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700"
        >
          {showForm ? "Cancelar" : "+ Nova empresa"}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Cada empresa tem seus próprios produtos, fornecedores, clientes e configurações — totalmente isolados das outras.
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da empresa</label>
            <input
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Odoya"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Slug (identificador interno)</label>
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
          <p className="text-xs text-slate-500 bg-amber-50 rounded-md px-3 py-2">
            O domínio (endereço público da loja/admin) é configurado depois, quando o cliente tiver o domínio próprio pronto —
            use "Editar domínio" na lista abaixo.
          </p>
          <button type="submit" disabled={submitting} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
            {submitting ? "Criando..." : "Criar empresa"}
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Nome</th>
              <th className="text-left px-4 py-2.5">Domínio (loja)</th>
              <th className="text-left px-4 py-2.5">Domínio (admin)</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.domain ?? <span className="text-amber-600">não configurado</span>}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.adminDomain ?? <span className="text-amber-600">não configurado</span>}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.active ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button type="button" onClick={() => setEditingCompany(c)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    Editar domínio
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingCompany && (
        <EditCompanyModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          onSaved={() => {
            setEditingCompany(null);
            refresh();
          }}
        />
      )}
    </AdminShell>
  );
}

function EditCompanyModal({ company, onClose, onSaved }: { company: Company; onClose: () => void; onSaved: () => void }) {
  const [domain, setDomain] = useState(company.domain ?? "");
  const [adminDomain, setAdminDomain] = useState(company.adminDomain ?? "");
  const [active, setActive] = useState(company.active);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await apiClient.updateCompany(company.id, { domain: domain.trim(), adminDomain: adminDomain.trim(), active });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Domínio — {company.name}</h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Domínio da loja</label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="ex: odoya.com.br"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Domínio do admin</label>
          <input
            value={adminDomain}
            onChange={(e) => setAdminDomain(e.target.value)}
            placeholder="ex: admin.odoya.com.br"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>
        <p className="text-xs text-slate-500">
          Sem o "https://", só o host. Precisa apontar de verdade pro Worker no Cloudflare pra funcionar — isso aqui só ensina
          o backend a reconhecer o domínio.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Empresa ativa
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
