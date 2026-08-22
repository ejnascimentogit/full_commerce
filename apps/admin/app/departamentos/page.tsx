"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { Category } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function DepartamentosPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<Record<string, { name: string; icon: string }>>({});

  useEffect(() => {
    if (user && user.role !== "platformAdmin") router.replace("/");
  }, [user, router]);

  function refresh() {
    apiClient.getCategories().then(setCategories);
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await apiClient.createCategory({ name, icon: icon || undefined, slug: "" });
    setName("");
    setIcon("");
    setShowForm(false);
    setSubmitting(false);
    refresh();
  }

  function startEditing(category: Category) {
    setEditing((prev) => ({ ...prev, [category.id]: { name: category.name, icon: category.icon ?? "" } }));
  }

  function cancelEditing(id: string) {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveEditing(id: string) {
    const draft = editing[id];
    if (!draft) return;
    await apiClient.updateCategory(id, { name: draft.name, icon: draft.icon || undefined });
    cancelEditing(id);
    refresh();
  }

  async function handleDelete(category: Category) {
    await apiClient.deleteCategory(category.id);
    refresh();
  }

  if (user?.role !== "platformAdmin") return null;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Departamentos</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700"
        >
          {showForm ? "Cancelar" : "+ Novo departamento"}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        São as categorias que aparecem no menu &quot;Todos os Departamentos&quot; da loja e no filtro do catálogo.
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-lg p-5 mb-6 flex gap-3 items-end max-w-xl">
          <div className="w-20">
            <label className="block text-sm font-medium text-slate-700 mb-1">Ícone</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🍪" className="w-full border border-slate-300 rounded-md px-2 py-2 text-sm text-center" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
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
              <th className="text-left px-4 py-2.5 w-16">Ícone</th>
              <th className="text-left px-4 py-2.5">Nome</th>
              <th className="text-left px-4 py-2.5">Slug</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((c) => {
              const draft = editing[c.id];
              return (
                <tr key={c.id}>
                  {draft ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          value={draft.icon}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [c.id]: { ...prev[c.id], icon: e.target.value } }))}
                          className="w-12 border border-slate-300 rounded-md px-1 py-1 text-sm text-center"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={draft.name}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [c.id]: { ...prev[c.id], name: e.target.value } }))}
                          className="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 text-slate-400">{c.slug}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button type="button" onClick={() => saveEditing(c.id)} className="text-brand-600 hover:underline mr-3">
                          Salvar
                        </button>
                        <button type="button" onClick={() => cancelEditing(c.id)} className="text-slate-400 hover:underline">
                          Cancelar
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5">{c.icon || "—"}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{c.name}</td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{c.slug}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button type="button" onClick={() => startEditing(c)} className="text-brand-600 hover:underline mr-3">
                          Editar
                        </button>
                        <button type="button" onClick={() => handleDelete(c)} className="text-red-600 hover:underline">
                          Remover
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {categories.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">Nenhum departamento cadastrado.</p>}
      </div>
    </AdminShell>
  );
}
