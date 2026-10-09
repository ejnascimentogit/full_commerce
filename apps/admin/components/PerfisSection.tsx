"use client";

import { useEffect, useState } from "react";
import { apiClient, ALL_PERMISSION_KEYS, PERMISSION_GROUPS, permissionLabel, setPermission } from "@ecommerce/api-client";
import type { AccessAuditEntry, AccessProfile, PermissionKey } from "@ecommerce/types";
import { CollapsibleSection } from "./CollapsibleSection";
import { PermissionToggle } from "./PermissionToggle";

const ERROR_MESSAGE: Record<string, string> = {
  PROFILE_IN_USE: "Este perfil está em uso. Troque o perfil das pessoas que o usam antes de excluí-lo.",
  PROFILE_PROTECTED: "O perfil Administrador sempre tem todas as permissões e não pode ser alterado nem excluído.",
  DUPLICATE_PROFILE: "Já existe um perfil com esse nome.",
  INVALID_INPUT: "Dê um nome ao perfil.",
};

function errorText(err: unknown, fallback: string): string {
  const code = err instanceof Error ? err.message : "";
  return ERROR_MESSAGE[code] ?? fallback;
}

interface Draft {
  id?: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

function labels(keys: unknown): string {
  return Array.isArray(keys) ? keys.map((k) => permissionLabel(k as PermissionKey)).join(", ") : "";
}

// Frase curta do histórico de mudanças de acesso.
function describeAudit(e: AccessAuditEntry): string {
  const d = e.details ?? {};
  switch (e.action) {
    case "profile.create":
      return `criou o perfil "${e.targetName}"`;
    case "profile.update": {
      const added = labels(d.added);
      const removed = labels(d.removed);
      const parts = [added && `liberou: ${added}`, removed && `bloqueou: ${removed}`, d.renamedFrom ? `antes se chamava "${String(d.renamedFrom)}"` : ""].filter(Boolean);
      return `alterou o perfil "${e.targetName}"${parts.length ? ` (${parts.join(" · ")})` : ""}`;
    }
    case "profile.delete":
      return `excluiu o perfil "${e.targetName}"`;
    case "member.create":
      return `cadastrou ${e.targetName}${d.profile ? ` com o perfil "${String(d.profile)}"` : ""}`;
    case "member.profile":
      return `trocou o perfil de ${e.targetName}: ${String(d.from ?? "sem perfil")} → ${String(d.to ?? "")}`;
    case "member.adjust": {
      const grants = labels(d.grants);
      const revokes = labels(d.revokes);
      const parts = [grants && `liberou só pra ela: ${grants}`, revokes && `bloqueou só pra ela: ${revokes}`].filter(Boolean);
      return `ajustou o acesso de ${e.targetName}${parts.length ? ` (${parts.join(" · ")})` : " (voltou ao padrão do perfil)"}`;
    }
    case "member.activate":
      return `reativou o login de ${e.targetName}`;
    case "member.deactivate":
      return `desativou o login de ${e.targetName}`;
    default:
      return `${e.action} ${e.targetName}`;
  }
}

export function PerfisSection() {
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState<AccessAuditEntry[] | null>(null);

  function loadAudit() {
    apiClient
      .getAccessAudit()
      .then((list) => setAudit(list ?? []))
      .catch(() => setAudit([]));
  }

  function refresh() {
    apiClient
      .getAccessProfiles()
      .then((list) => setProfiles(list ?? []))
      .catch(() => setError("Não foi possível carregar os perfis."));
    if (showAudit) loadAudit();
  }

  useEffect(refresh, []);

  function toggleAudit() {
    const next = !showAudit;
    setShowAudit(next);
    if (next) loadAudit();
  }

  function startNew() {
    setError(null);
    setDraft({ name: "", description: "", permissions: [] });
  }

  function startCopy(p: AccessProfile) {
    setError(null);
    setDraft({ name: `${p.name} (cópia)`, description: p.description, permissions: [...p.permissions] });
  }

  function startEdit(p: AccessProfile) {
    setError(null);
    setDraft({ id: p.id, name: p.name, description: p.description, permissions: [...p.permissions] });
  }

  function setAll(on: boolean, keys: PermissionKey[] = ALL_PERMISSION_KEYS) {
    setDraft((d) => (d ? { ...d, permissions: keys.reduce((acc, k) => setPermission(acc, k, on), d.permissions) } : d));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    setSaving(true);
    try {
      const body = { name: draft.name, description: draft.description, permissions: draft.permissions };
      if (draft.id) await apiClient.updateAccessProfile(draft.id, body);
      else await apiClient.createAccessProfile(body);
      setDraft(null);
      refresh();
    } catch (err) {
      setError(errorText(err, "Não foi possível salvar o perfil."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: AccessProfile) {
    if (!window.confirm(`Excluir o perfil "${p.name}"?`)) return;
    setError(null);
    try {
      await apiClient.deleteAccessProfile(p.id);
      refresh();
    } catch (err) {
      setError(errorText(err, "Não foi possível excluir o perfil."));
    }
  }

  const total = ALL_PERMISSION_KEYS.length;

  return (
    <CollapsibleSection
      expandKey="perfis"
      title="Perfis de acesso"
      className="bg-white border border-slate-200 shadow-md rounded-lg p-5 mt-6 max-w-2xl"
      action={
        <button type="button" onClick={startNew} className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 py-1.5 hover:bg-brand-50">
          + Novo perfil
        </button>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        Um perfil é um conjunto de permissões (ex: Vendedor, Financeiro). Ao cadastrar uma pessoa na Equipe você escolhe o perfil dela — e, se precisar, ajusta só
        aquela pessoa sem mexer no perfil dos outros. Configurações, Equipe e Perfis ficam sempre só com o administrador da empresa.
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {draft && (
        <form onSubmit={handleSave} className="border border-brand-200 rounded-lg p-4 mb-4 space-y-4 bg-brand-50/30">
          <p className="font-medium text-slate-900">{draft.id ? "Editar perfil" : "Novo perfil"}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
              <input
                required
                maxLength={60}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
              <input
                maxLength={200}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Para que serve este perfil"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              Permissões <span className="text-slate-400 font-normal">({draft.permissions.length} de {total})</span>
            </p>
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => setAll(true)} className="text-brand-600 hover:underline">
                Liberar todos
              </button>
              <button type="button" onClick={() => setAll(false)} className="text-slate-500 hover:underline">
                Bloquear todos
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.id} className="border border-slate-200 rounded-lg bg-white">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">
                    <span aria-hidden>{group.icon}</span> {group.label}
                  </p>
                  <div className="flex gap-3 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setAll(
                          true,
                          group.items.map((i) => i.key),
                        )
                      }
                      className="text-brand-600 hover:underline"
                    >
                      Liberar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAll(
                          false,
                          group.items.map((i) => i.key),
                        )
                      }
                      className="text-slate-500 hover:underline"
                    >
                      Bloquear
                    </button>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <li key={item.key} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                      <PermissionToggle
                        on={draft.permissions.includes(item.key)}
                        label={item.label}
                        onChange={(next) => setDraft({ ...draft, permissions: setPermission(draft.permissions, item.key, next) })}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">Liberar uma ação (editar, responder, converter...) libera também o "ver" dela; bloquear o "ver" bloqueia as ações.</p>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar perfil"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="text-sm text-slate-600 border border-slate-300 rounded-md px-4 py-2 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {profiles.map((p) => {
          const count = p.permissions.length;
          return (
            <div key={p.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {p.name}
                    {p.isAdmin && <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full align-middle">🔒 protegido</span>}
                  </p>
                  {p.description && <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>}
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {p.memberCount} {p.memberCount === 1 ? "pessoa" : "pessoas"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                {p.isAdmin ? "Sempre com todas as permissões" : `${count} de ${total} permissões`}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {PERMISSION_GROUPS.map((g) => {
                  const n = g.items.filter((i) => p.permissions.includes(i.key)).length;
                  if (n === 0) return null;
                  return (
                    <span key={g.id} className="text-[11px] bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2 py-0.5">
                      {g.label} {n}/{g.items.length}
                    </span>
                  );
                })}
                {count === 0 && <span className="text-xs text-slate-400">Sem acesso a nenhuma área.</span>}
              </div>
              <div className="flex gap-3 mt-3 text-xs">
                {!p.isAdmin && (
                  <button type="button" onClick={() => startEdit(p)} className="text-brand-600 hover:underline">
                    Editar
                  </button>
                )}
                <button type="button" onClick={() => startCopy(p)} className="text-brand-600 hover:underline">
                  Duplicar
                </button>
                {!p.isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    disabled={p.memberCount > 0}
                    title={p.memberCount > 0 ? "Perfil em uso: troque o perfil das pessoas antes de excluir" : undefined}
                    className="text-red-600 hover:underline disabled:text-slate-300 disabled:no-underline"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {profiles.length === 0 && !error && <p className="text-sm text-slate-500">Carregando perfis...</p>}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-3">
        <button type="button" onClick={toggleAudit} className="text-xs text-slate-600 hover:underline">
          {showAudit ? "▾ Ocultar histórico de mudanças de acesso" : "▸ Ver histórico de mudanças de acesso"}
        </button>
        {showAudit && (
          <ul className="mt-2 space-y-1.5">
            {(audit ?? []).map((e) => (
              <li key={e.id} className="text-xs text-slate-600">
                <span className="text-slate-400">{new Date(e.createdAt).toLocaleString("pt-BR")}</span> — <strong>{e.actorName || "Alguém"}</strong> {describeAudit(e)}
              </li>
            ))}
            {audit && audit.length === 0 && <li className="text-xs text-slate-400">Nenhuma mudança registrada ainda.</li>}
            {!audit && <li className="text-xs text-slate-400">Carregando...</li>}
          </ul>
        )}
      </div>
    </CollapsibleSection>
  );
}
