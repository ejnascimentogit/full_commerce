"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { ActivityOutcome } from "@ecommerce/types";

export function ActivityOutcomesSection() {
  const [outcomes, setOutcomes] = useState<ActivityOutcome[]>([]);
  const [name, setName] = useState("");

  function refresh() {
    apiClient.getActivityOutcomes().then(setOutcomes);
  }

  useEffect(refresh, []);

  async function handleAdd() {
    if (!name.trim()) return;
    await apiClient.createActivityOutcome(name.trim());
    setName("");
    refresh();
  }

  async function toggleActive(outcome: ActivityOutcome) {
    await apiClient.updateActivityOutcome(outcome.id, { active: !outcome.active });
    refresh();
  }

  return (
    <section className="bg-white border border-slate-200 shadow-md rounded-lg p-5 mt-6 max-w-2xl">
      <h2 className="font-semibold text-slate-900 mb-1">Status de conclusão de atividades</h2>
      <p className="text-sm text-slate-500 mb-4">
        O que significa "concluído" num card de Atividades — ex: "Convertido em venda", "Cobrança resolvida". Aparece quando alguém move um card pra
        Concluído.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Convertido em venda"
          className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <button type="button" onClick={handleAdd} className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 hover:bg-brand-50">
          + Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {outcomes.map((o) => (
          <div key={o.id} className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2 text-sm">
            <span className={o.active ? "text-slate-900" : "text-slate-400 line-through"}>{o.name}</span>
            <button
              type="button"
              onClick={() => toggleActive(o)}
              className={`text-xs px-2 py-0.5 rounded-full ${o.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
            >
              {o.active ? "Ativo" : "Inativo"}
            </button>
          </div>
        ))}
        {outcomes.length === 0 && <p className="text-sm text-slate-500">Nenhum status cadastrado ainda.</p>}
      </div>
    </section>
  );
}
