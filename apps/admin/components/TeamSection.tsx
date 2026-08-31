"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { AdminPermissionKey, AdminUser, StaffSector } from "@ecommerce/types";

const PERMISSION_LABEL: Record<AdminPermissionKey, string> = {
  produtos: "Produtos",
  pedidos: "Pedidos",
  clientes: "Clientes",
  financeiro: "Financeiro",
  promocoes: "Promoções",
  departamentos: "Departamentos",
  fornecedores: "Fornecedores",
  atividades: "Atividades",
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL) as AdminPermissionKey[];

export function TeamSection() {
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [sectors, setSectors] = useState<StaffSector[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [newSector, setNewSector] = useState("");
  const [permissions, setPermissions] = useState<AdminPermissionKey[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    apiClient.getTeamMembers().then(setMembers);
    apiClient.getStaffSectors().then(setSectors);
  }

  useEffect(refresh, []);

  async function handleAddSector() {
    if (!newSector.trim()) return;
    await apiClient.createStaffSector(newSector.trim());
    setNewSector("");
    refresh();
  }

  async function handleRemoveSector(id: string) {
    await apiClient.deleteStaffSector(id);
    refresh();
  }

  function togglePermission(key: AdminPermissionKey) {
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.createTeamMember({ name, email, password, permissions, department: department.trim() || undefined });
      setName("");
      setEmail("");
      setPassword("");
      setDepartment("");
      setPermissions([]);
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error && err.message === "EMAIL_IN_USE" ? "Já existe uma conta com esse e-mail." : "Não foi possível criar o login.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleMemberPermission(member: AdminUser, key: AdminPermissionKey) {
    const current = member.permissions ?? [];
    const next = current.includes(key) ? current.filter((p) => p !== key) : [...current, key];
    await apiClient.updateTeamMember(member.id, { permissions: next });
    refresh();
  }

  async function toggleActive(member: AdminUser) {
    await apiClient.updateTeamMember(member.id, { active: !(member.active ?? true) });
    refresh();
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5 mt-6 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-900">Equipe</h2>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 py-1.5 hover:bg-brand-50"
        >
          {showForm ? "Cancelar" : "+ Adicionar pessoa"}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Logins de vendedor, financeiro etc. — cada um vê só as abas marcadas abaixo, nunca Empresas ou Configurações.
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="border border-slate-200 rounded-lg p-4 mb-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cargo/Setor (opcional)</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Sem cargo/setor</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2 mt-2">
              <input
                value={newSector}
                onChange={(e) => setNewSector(e.target.value)}
                placeholder="Cadastrar novo setor (ex: Televendas)"
                className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-xs"
              />
              <button type="button" onClick={handleAddSector} className="text-xs text-brand-600 border border-brand-200 rounded-md px-3 hover:bg-brand-50">
                + Adicionar
              </button>
            </div>
            {sectors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sectors.map((s) => (
                  <span key={s.id} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">
                    {s.name}
                    <button type="button" onClick={() => handleRemoveSector(s.id)} className="text-slate-400 hover:text-red-600">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha inicial</label>
            <input
              required
              type="text"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="A pessoa pode trocar depois pelo próprio login"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Abas que essa pessoa pode acessar</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PERMISSIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePermission(key)}
                  className={`text-sm font-medium rounded-full px-3 py-1.5 border ${
                    permissions.includes(key) ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-300 text-slate-500"
                  }`}
                >
                  {permissions.includes(key) ? "✓ " : ""}
                  {PERMISSION_LABEL[key]}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
            {submitting ? "Criando..." : "Criar login"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-slate-900">
                  {member.name}
                  {member.department && <span className="ml-2 text-xs font-normal text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">{member.department}</span>}
                </p>
                <p className="text-xs text-slate-500">{member.email}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(member)}
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${(member.active ?? true) ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
              >
                {(member.active ?? true) ? "Ativo" : "Desativado"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_PERMISSIONS.map((key) => {
                const has = (member.permissions ?? []).includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleMemberPermission(member, key)}
                    className={`text-xs font-medium rounded-full px-2.5 py-1 border ${
                      has ? "bg-brand-50 border-brand-200 text-brand-700" : "bg-white border-slate-200 text-slate-400"
                    }`}
                  >
                    {has ? "✓ " : ""}
                    {PERMISSION_LABEL[key]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {members.length === 0 && <p className="text-sm text-slate-500">Nenhuma pessoa de equipe cadastrada ainda.</p>}
      </div>
    </section>
  );
}
