"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { Activity, ActivityClient, ActivityHealth, ActivityOutcome, AdminUser } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

const HEALTH_LABEL: Record<ActivityHealth, string> = { green: "Verde", amber: "Amarelo", red: "Vermelho" };
const HEALTH_COLOR: Record<ActivityHealth, string> = {
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

export default function AtividadesClientesPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [clients, setClients] = useState<ActivityClient[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [outcomes, setOutcomes] = useState<ActivityOutcome[]>([]);
  const [people, setPeople] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<ActivityClient | null>(null);
  const [healthFilter, setHealthFilter] = useState("");

  const canAccess = user?.role === "platformAdmin" || (user?.role === "staff" && (user.permissions ?? []).includes("atividades"));

  useEffect(() => {
    if (user && !canAccess) router.replace("/");
  }, [user, canAccess, router]);

  function refresh() {
    Promise.all([apiClient.getActivityClients(), apiClient.getActivities(), apiClient.getActivityOutcomes(), apiClient.getTeamMembers()]).then(
      ([c, a, o, staff]) => {
        setClients(c);
        setActivities(a);
        setOutcomes(o);
        setPeople(user && user.role === "platformAdmin" ? [{ ...user, id: user.id }, ...staff] : staff);
      },
    );
  }

  useEffect(() => {
    if (canAccess) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const outcomeById = useMemo(() => new Map(outcomes.map((o) => [o.id, o])), [outcomes]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const filteredClients = useMemo(() => (healthFilter ? clients.filter((c) => c.health === healthFilter) : clients), [clients, healthFilter]);

  const history = useMemo(() => {
    if (!selected) return [];
    return activities
      .filter((a) => a.clientId === selected.id && a.column === "done")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  }, [activities, selected]);

  async function saveClient(patch: Partial<{ health: ActivityHealth; healthReason: string; nextContactAt: string | null }>) {
    if (!selected) return;
    const updated = await apiClient.updateActivityClient(selected.id, patch);
    setSelected(updated);
    refresh();
  }

  if (!canAccess) return null;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes das Atividades</h1>
          <p className="text-sm text-slate-500 mt-1">Saúde do relacionamento e histórico de contatos concluídos.</p>
        </div>
        <Link href="/atividades" className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 py-2 hover:bg-brand-50">
          ← Voltar pro quadro
        </Link>
      </div>

      <div className="grid grid-cols-[22rem_1fr] gap-4">
        <div>
          <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white mb-3">
            <option value="">Todas as saúdes</option>
            <option value="green">Verde</option>
            <option value="amber">Amarelo</option>
            <option value="red">Vermelho</option>
          </select>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {filteredClients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className={`w-full text-left border rounded-lg p-3 ${selected?.id === c.id ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">{c.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${HEALTH_COLOR[c.health]}`}>{HEALTH_LABEL[c.health]}</span>
                </div>
                {c.nextContactAt && <p className="text-xs text-slate-500 mt-1">Próximo contato: {c.nextContactAt}</p>}
              </button>
            ))}
            {filteredClients.length === 0 && <p className="text-sm text-slate-500">Nenhum cliente ainda — crie uma atividade no quadro.</p>}
          </div>
        </div>

        <div>
          {selected ? (
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="font-semibold text-slate-900 mb-1">{selected.name}</h2>
              <p className="text-sm text-slate-500 mb-4">{selected.phone || "Sem telefone cadastrado"}</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Saúde</label>
                  <select
                    value={selected.health}
                    onChange={(e) => saveClient({ health: e.target.value as ActivityHealth })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="green">Verde</option>
                    <option value="amber">Amarelo</option>
                    <option value="red">Vermelho</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Próximo contato</label>
                  <input
                    type="date"
                    value={selected.nextContactAt ?? ""}
                    onChange={(e) => saveClient({ nextContactAt: e.target.value || null })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo (se amarelo/vermelho)</label>
                <input
                  value={selected.healthReason ?? ""}
                  onChange={(e) => setSelected({ ...selected, healthReason: e.target.value })}
                  onBlur={(e) => saveClient({ healthReason: e.target.value })}
                  placeholder="Ex: aguardando retorno do financeiro"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <h3 className="text-sm font-semibold text-slate-700 mb-2 border-t border-slate-100 pt-4">Histórico de contatos</h3>
              <div className="space-y-2">
                {history.map((a) => (
                  <div key={a.id} className="border border-slate-200 rounded-md p-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">{a.title}</span>
                      <span className="text-xs text-slate-400">#{a.cardNumber}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {a.completedAt?.slice(0, 10)} · {personById.get(a.assignedToAdminId)?.name ?? "?"} ·{" "}
                      {a.outcomeId ? outcomeById.get(a.outcomeId)?.name ?? "?" : "sem resultado"}
                    </p>
                  </div>
                ))}
                {history.length === 0 && <p className="text-sm text-slate-500">Nenhum contato concluído ainda.</p>}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 border border-dashed border-slate-200 rounded-lg text-sm text-slate-400">
              Escolha um cliente pra ver a ficha.
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
