"use client";

import { CollapsibleSection } from "./CollapsibleSection";
import { PermissionToggle } from "./PermissionToggle";
import { useEffect, useState } from "react";
import { apiClient, ALL_PERMISSION_KEYS, PERMISSION_GROUPS, permissionLabel, setPermission } from "@ecommerce/api-client";
import type { AccessProfile, AdminUser, PermissionKey, StaffSector } from "@ecommerce/types";

const ERROR_MESSAGE: Record<string, string> = {
  EMAIL_IN_USE: "Já existe uma conta com esse e-mail.",
  PROFILE_NOT_FOUND: "Esse perfil não existe mais. Atualize a página.",
  INVALID_INPUT: "Confira os campos e escolha um perfil de acesso.",
};

function errorText(err: unknown, fallback: string): string {
  const code = err instanceof Error ? err.message : "";
  return ERROR_MESSAGE[code] ?? fallback;
}

export function TeamSection() {
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [sectors, setSectors] = useState<StaffSector[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [profileId, setProfileId] = useState("");
  // Enquanto a pessoa não escolhe o perfil na mão, ele acompanha a sugestão do setor; depois de escolher, o setor não mexe mais.
  const [profileTouched, setProfileTouched] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [newSector, setNewSector] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  function refresh() {
    apiClient.getTeamMembers().then((list) => setMembers(list ?? []));
    apiClient.getStaffSectors().then((list) => setSectors(list ?? []));
    apiClient
      .getAccessProfiles()
      .then((list) => setProfiles(list ?? []))
      .catch(() => setProfiles([]));
  }

  useEffect(refresh, []);

  const sectorById = new Map(sectors.map((s) => [s.id, s]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const selectedProfile = profileById.get(profileId);
  const suggestedProfile = profileById.get(sectorById.get(sectorId)?.defaultProfileId ?? "");
  const total = ALL_PERMISSION_KEYS.length;

  // Executa uma alteração, mostra o erro se houver e recarrega a lista.
  async function run(action: () => Promise<unknown>, fallback = "Não foi possível salvar a alteração.") {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorText(err, fallback));
    }
    refresh();
  }

  async function handleAddSector() {
    if (!newSector.trim()) return;
    await run(() => apiClient.createStaffSector(newSector.trim()));
    setNewSector("");
  }

  function handleSectorChoice(id: string) {
    setSectorId(id);
    if (!profileTouched) {
      const suggestion = sectorById.get(id)?.defaultProfileId;
      setProfileId(suggestion ?? "");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!profileId) {
      setError("Escolha um perfil de acesso.");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.createTeamMember({ name, email, password, profileId, sectorId: sectorId || undefined, isSupervisor, isManager });
      setName("");
      setEmail("");
      setPassword("");
      setSectorId("");
      setProfileId("");
      setProfileTouched(false);
      setIsSupervisor(false);
      setIsManager(false);
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(errorText(err, "Não foi possível criar o login."));
    } finally {
      setSubmitting(false);
    }
  }

  function changeProfile(member: AdminUser, newProfileId: string) {
    if (!newProfileId || newProfileId === member.profileId) return;
    const target = profileById.get(newProfileId);
    if (!member.profileId && !window.confirm(`Isto troca o acesso atual de ${member.name} pelo do perfil "${target?.name ?? ""}". Continuar?`)) return;
    run(() => apiClient.updateTeamMember(member.id, { profileId: newProfileId }));
  }

  // O que a tela manda é só o que difere do perfil: liberadas a mais e bloqueadas.
  function setMemberPermission(member: AdminUser, profile: AccessProfile | undefined, key: PermissionKey, on: boolean) {
    const desired = setPermission(member.effectivePermissions ?? [], key, on);
    const base = new Set<PermissionKey>(profile?.permissions ?? []);
    const permissionGrants = desired.filter((k) => !base.has(k));
    const permissionRevokes = [...base].filter((k) => !desired.includes(k));
    run(() => apiClient.updateTeamMember(member.id, { permissionGrants, permissionRevokes }));
  }

  return (
    <CollapsibleSection
      expandKey="equipe"
      title="Equipe"
      className="bg-white border border-slate-200 shadow-md rounded-lg p-5 mt-6 max-w-2xl"
      action={
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 py-1.5 hover:bg-brand-50"
        >
          {showForm ? "Cancelar" : "+ Adicionar pessoa"}
        </button>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        Logins de vendedor, financeiro etc. — cada pessoa tem um perfil de acesso (veja "Perfis de acesso") e vê só o que o perfil libera, nunca Empresas ou
        Configurações. Se precisar, ajuste só uma pessoa sem mexer no perfil dos outros. O setor e o nível (usuário, supervisor, gerente) controlam o que a pessoa
        vê dentro de Atividades.
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Setor</label>
            <select value={sectorId} onChange={(e) => handleSectorChoice(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">Sem setor</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.seesAll ? " (vê tudo)" : ""}
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
                  <span key={s.id} className="flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">
                    {s.name}
                    <button
                      type="button"
                      onClick={() => run(() => apiClient.updateStaffSector(s.id, { seesAll: !s.seesAll }))}
                      title="Marcar esse setor como visão total (ex: Diretoria) — qualquer pessoa dele enxerga Atividades de todos os setores"
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s.seesAll ? "bg-brand-600 text-white" : "bg-white border border-slate-300 text-slate-500"}`}
                    >
                      vê tudo
                    </button>
                    <button type="button" onClick={() => run(() => apiClient.deleteStaffSector(s.id))} className="text-slate-400 hover:text-red-600">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            {sectors.length > 0 && profiles.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-2">
                <p className="text-xs font-medium text-slate-600 mb-1">
                  Perfil sugerido em cada setor <span className="font-normal text-slate-400">(só sugere ao cadastrar — quem cadastra pode trocar)</span>
                </p>
                {sectors.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-xs text-slate-700">{s.name}</span>
                    <select
                      value={s.defaultProfileId ?? ""}
                      onChange={(e) => run(() => apiClient.updateStaffSector(s.id, { defaultProfileId: e.target.value || null }))}
                      className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white"
                    >
                      <option value="">Nenhum</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isSupervisor} onChange={(e) => setIsSupervisor(e.target.checked)} />
              É supervisor (vê todo o setor)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isManager} onChange={(e) => setIsManager(e.target.checked)} />
              É gerente (vê todos os setores)
            </label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Perfil de acesso</label>
            <select
              required
              value={profileId}
              onChange={(e) => {
                setProfileId(e.target.value);
                setProfileTouched(true);
              }}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Escolha um perfil</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selectedProfile && (
              <p className="text-xs text-slate-500 mt-1">
                {selectedProfile.isAdmin ? "Todas as permissões" : `${selectedProfile.permissions.length} de ${total} permissões`}
                {selectedProfile.description ? ` — ${selectedProfile.description}` : ""}
              </p>
            )}
            {suggestedProfile && !profileTouched && <p className="text-xs text-brand-700 mt-1">Sugerido pelo setor: {suggestedProfile.name}.</p>}
            <p className="text-xs text-slate-400 mt-1">Depois de criar, dá pra ajustar só essa pessoa (liberar ou bloquear algo) sem mexer no perfil.</p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
            {submitting ? "Criando..." : "Criar login"}
          </button>
        </form>
      )}

      {!showForm && error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="space-y-3">
        {members.map((member) => {
          const profile = member.profileId ? profileById.get(member.profileId) : undefined;
          const effective = member.effectivePermissions ?? [];
          const grants = member.permissionGrants ?? [];
          const revokes = member.permissionRevokes ?? [];
          const hasAdjustments = grants.length > 0 || revokes.length > 0;
          const adjusting = adjustingId === member.id && !!member.profileId;
          return (
            <div key={member.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-slate-900">{member.name}</p>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => run(() => apiClient.updateTeamMember(member.id, { active: !(member.active ?? true) }))}
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${(member.active ?? true) ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                >
                  {(member.active ?? true) ? "Ativo" : "Desativado"}
                </button>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <select
                  value={member.sectorId ?? ""}
                  onChange={(e) => run(() => apiClient.updateTeamMember(member.id, { sectorId: e.target.value || null }))}
                  className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white"
                >
                  <option value="">Sem setor</option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={member.isSupervisor ?? false}
                    onChange={() => run(() => apiClient.updateTeamMember(member.id, { isSupervisor: !(member.isSupervisor ?? false) }))}
                  />
                  Supervisor
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={member.isManager ?? false}
                    onChange={() => run(() => apiClient.updateTeamMember(member.id, { isManager: !(member.isManager ?? false) }))}
                  />
                  Gerente
                </label>
                {member.sectorId && sectorById.get(member.sectorId)?.seesAll && (
                  <span className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full">setor vê tudo</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-slate-600">Perfil</label>
                <select
                  value={member.profileId ?? ""}
                  onChange={(e) => changeProfile(member, e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white"
                >
                  {!member.profileId && <option value="">Escolha um perfil</option>}
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {member.effectivePermissions && (
                  <span className="text-xs text-slate-500">
                    {effective.length} de {total} permissões
                  </span>
                )}
                {member.profileId && (
                  <button type="button" onClick={() => setAdjustingId(adjusting ? null : member.id)} className="text-xs text-brand-600 hover:underline">
                    {adjusting ? "Fechar ajustes" : "Ajustar só esta pessoa"}
                  </button>
                )}
              </div>

              {!member.profileId && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2">
                  Esta pessoa ainda usa a lista antiga de abas. O acesso dela continua o mesmo; escolha um perfil acima para passar ao novo modelo.
                </p>
              )}

              {hasAdjustments && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {grants.map((k) => (
                    <span key={`g-${k}`} className="text-[11px] bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                      + {permissionLabel(k)}
                    </span>
                  ))}
                  {revokes.map((k) => (
                    <span key={`r-${k}`} className="text-[11px] bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                      − {permissionLabel(k)}
                    </span>
                  ))}
                </div>
              )}

              {adjusting && (
                <div className="border border-slate-200 rounded-lg mt-3 bg-slate-50/50">
                  <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200">
                    <p className="text-xs text-slate-600">
                      Ajustes só de {member.name}. O perfil <strong>{profile?.name ?? ""}</strong> e as outras pessoas não mudam.
                    </p>
                    {hasAdjustments && (
                      <button
                        type="button"
                        onClick={() => run(() => apiClient.updateTeamMember(member.id, { permissionGrants: [], permissionRevokes: [] }))}
                        className="text-xs text-brand-600 hover:underline shrink-0"
                      >
                        Voltar ao padrão do perfil
                      </button>
                    )}
                  </div>
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.id} className="px-3 py-2">
                      <p className="text-xs font-semibold text-slate-700 mb-1">
                        <span aria-hidden>{group.icon}</span> {group.label}
                      </p>
                      <ul>
                        {group.items.map((item) => {
                          const on = effective.includes(item.key);
                          const inProfile = profile?.permissions.includes(item.key) ?? false;
                          let tag: React.ReactNode = null;
                          if (on && inProfile) tag = <span className="ml-2 text-[10px] text-slate-400">do perfil</span>;
                          else if (on) tag = <span className="ml-2 text-[10px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5">liberada só pra esta pessoa</span>;
                          else if (inProfile && revokes.includes(item.key)) tag = <span className="ml-2 text-[10px] bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">bloqueada só pra esta pessoa</span>;
                          else if (inProfile) tag = <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">desligada: falta o "ver"</span>;
                          return (
                            <li key={item.key} className="flex items-center justify-between gap-2 py-1">
                              <div className="min-w-0">
                                <span className="text-xs text-slate-800">{item.label}</span>
                                {tag}
                              </div>
                              <PermissionToggle on={on} label={item.label} onChange={(next) => setMemberPermission(member, profile, item.key, next)} />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {members.length === 0 && <p className="text-sm text-slate-500">Nenhuma pessoa de equipe cadastrada ainda.</p>}
      </div>
    </CollapsibleSection>
  );
}
