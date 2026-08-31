"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { Activity, ActivityClient, ActivityOutcome, AdminUser } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AtividadesDesempenhoPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [clients, setClients] = useState<ActivityClient[]>([]);
  const [outcomes, setOutcomes] = useState<ActivityOutcome[]>([]);
  const [people, setPeople] = useState<AdminUser[]>([]);
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [copied, setCopied] = useState(false);

  const canAccess = user?.role === "platformAdmin" || (user?.role === "staff" && (user.permissions ?? []).includes("atividades"));

  useEffect(() => {
    if (user && !canAccess) router.replace("/");
  }, [user, canAccess, router]);

  useEffect(() => {
    if (!canAccess) return;
    Promise.all([apiClient.getActivities(), apiClient.getActivityClients(), apiClient.getActivityOutcomes(), apiClient.getTeamMembers()]).then(
      ([a, c, o, staff]) => {
        setActivities(a);
        setClients(c);
        setOutcomes(o);
        setPeople(user && user.role === "platformAdmin" ? [{ ...user, id: user.id }, ...staff] : staff);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const outcomeById = useMemo(() => new Map(outcomes.map((o) => [o.id, o])), [outcomes]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const completedInRange = useMemo(() => {
    return activities.filter((a) => a.column === "done" && a.completedAt && a.completedAt.slice(0, 10) >= from && a.completedAt.slice(0, 10) <= to);
  }, [activities, from, to]);

  const byPerson = useMemo(() => {
    const map = new Map<string, { person?: AdminUser; total: number; byOutcome: Map<string, number> }>();
    for (const a of completedInRange) {
      const entry = map.get(a.assignedToAdminId) ?? { person: personById.get(a.assignedToAdminId), total: 0, byOutcome: new Map() };
      entry.total += 1;
      const outcomeName = a.outcomeId ? outcomeById.get(a.outcomeId)?.name ?? "Sem resultado" : "Sem resultado";
      entry.byOutcome.set(outcomeName, (entry.byOutcome.get(outcomeName) ?? 0) + 1);
      map.set(a.assignedToAdminId, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [completedInRange, personById, outcomeById]);

  function summaryText() {
    const lines = [`Resumo de Atividades · ${from === to ? from : `${from} a ${to}`}`, ""];
    for (const [adminId, entry] of byPerson) {
      lines.push(`${entry.person?.name ?? adminId} — ${entry.total} atendimento${entry.total === 1 ? "" : "s"}`);
      for (const [outcomeName, count] of entry.byOutcome) lines.push(`  · ${outcomeName}: ${count}`);
    }
    if (byPerson.length === 0) lines.push("Nenhum atendimento concluído no período.");
    return lines.join("\n");
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(summaryText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!canAccess) return null;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Desempenho da equipe</h1>
          <p className="text-sm text-slate-500 mt-1">Atendimentos concluídos por pessoa, com o resultado de cada um.</p>
        </div>
        <Link href="/atividades" className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 py-2 hover:bg-brand-50">
          ← Voltar pro quadro
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>
        <button type="button" onClick={copyToClipboard} className="self-end text-sm text-brand-600 border border-brand-200 rounded-md px-4 py-2 hover:bg-brand-50">
          {copied ? "Copiado!" : "📄 Copiar resumo"}
        </button>
      </div>

      <div className="space-y-4">
        {byPerson.map(([adminId, entry]) => (
          <div key={adminId} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-900">{entry.person?.name ?? "Removido"}</h3>
              <span className="text-sm font-mono text-slate-500">{entry.total} atendimentos</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[...entry.byOutcome.entries()].map(([name, count]) => (
                <span key={name} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                  {name}: {count}
                </span>
              ))}
            </div>
          </div>
        ))}
        {byPerson.length === 0 && <p className="text-sm text-slate-500">Nenhum atendimento concluído no período selecionado.</p>}
      </div>
    </AdminShell>
  );
}
