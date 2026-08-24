"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { Vendor } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function FornecedoresPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [code, setCode] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogoFor, setUploadingLogoFor] = useState<string | null>(null);
  const [uploadingNewLogo, setUploadingNewLogo] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  useEffect(() => {
    if (user && user.role !== "platformAdmin") router.replace("/");
  }, [user, router]);

  function refresh() {
    apiClient.getVendors({ includeInactive: true }).then(setVendors);
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await apiClient.createVendor({
      name,
      cnpj,
      active: true,
      isFeatured: false,
      code: code || undefined,
      referenceCode: referenceCode || undefined,
      logoUrl,
    });
    setName("");
    setCnpj("");
    setCode("");
    setReferenceCode("");
    setLogoUrl(undefined);
    setShowForm(false);
    setSubmitting(false);
    refresh();
  }

  async function handleNewLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingNewLogo(true);
    const url = await apiClient.uploadLogo(file);
    setLogoUrl(url);
    setUploadingNewLogo(false);
  }

  async function handleLogoSelected(vendor: Vendor, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingLogoFor(vendor.id);
    const url = await apiClient.uploadLogo(file);
    await apiClient.updateVendor(vendor.id, { logoUrl: url });
    setUploadingLogoFor(null);
    refresh();
  }

  async function toggleFeatured(vendor: Vendor) {
    await apiClient.updateVendor(vendor.id, { isFeatured: !vendor.isFeatured });
    refresh();
  }

  async function toggleActive(vendor: Vendor) {
    await apiClient.updateVendor(vendor.id, { active: !vendor.active });
    refresh();
  }

  if (user?.role !== "platformAdmin") return null;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Fornecedores</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700"
        >
          {showForm ? "Cancelar" : "+ Novo fornecedor"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-xl space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
              <input required value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Código do fornecedor (opcional)</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Nosso código para esse fornecedor"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Código de referência (opcional)</label>
              <input
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="Código que ele usa pra nos identificar"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Logo (opcional)</label>
            <div className="flex items-center gap-3">
              <label className="relative w-14 h-14 rounded-md border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-brand-400 shrink-0 bg-white">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded vendor logo
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-slate-300 text-[10px] text-center px-0.5">{uploadingNewLogo ? "..." : "+ logo"}</span>
                )}
                <input type="file" accept="image/*" onChange={handleNewLogoSelected} disabled={uploadingNewLogo} className="hidden" />
              </label>
              {logoUrl && (
                <button type="button" onClick={() => setLogoUrl(undefined)} className="text-xs text-slate-500 hover:text-red-600">
                  Remover
                </button>
              )}
            </div>
          </div>
          <button type="submit" disabled={submitting} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
            Salvar
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Logo</th>
              <th className="text-left px-4 py-2.5">Nome</th>
              <th className="text-left px-4 py-2.5">Código</th>
              <th className="text-left px-4 py-2.5">CNPJ</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Destaque na home</th>
              <th className="text-left px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vendors.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2.5">
                  <label className="relative w-10 h-10 rounded-md border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-brand-400 shrink-0 bg-white">
                    {v.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded vendor logo
                      <img src={v.logoUrl} alt={v.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-slate-300 text-[10px] text-center px-0.5">
                        {uploadingLogoFor === v.id ? "..." : "+ logo"}
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoSelected(v, e)}
                      disabled={uploadingLogoFor === v.id}
                      className="hidden"
                    />
                  </label>
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{v.name}</td>
                <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{v.code ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{v.cnpj}</td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleActive(v)}
                    className={`text-xs px-2 py-0.5 rounded-full ${v.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {v.active ? "Ativo" : "Inativo"}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleFeatured(v)}
                    className={`text-xs px-2 py-0.5 rounded-full ${v.isFeatured ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {v.isFeatured ? "Em destaque" : "Não destacado"}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button type="button" onClick={() => setEditingVendor(v)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingVendor && (
        <EditVendorModal
          vendor={editingVendor}
          onClose={() => setEditingVendor(null)}
          onSaved={() => {
            setEditingVendor(null);
            refresh();
          }}
        />
      )}
    </AdminShell>
  );
}

function EditVendorModal({ vendor, onClose, onSaved }: { vendor: Vendor; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(vendor.name);
  const [cnpj, setCnpj] = useState(vendor.cnpj);
  const [code, setCode] = useState(vendor.code ?? "");
  const [referenceCode, setReferenceCode] = useState(vendor.referenceCode ?? "");
  const [description, setDescription] = useState(vendor.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await apiClient.updateVendor(vendor.id, {
      name,
      cnpj,
      code: code || undefined,
      referenceCode: referenceCode || undefined,
      description: description || undefined,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg p-6 w-full max-w-md space-y-4"
      >
        <h2 className="text-lg font-bold text-slate-900">Editar fornecedor</h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
          <input required value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Código do fornecedor</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Código de referência</label>
            <input value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>

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
