"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { DeliveryRegion } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function RegioesPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [cutoffTime, setCutoffTime] = useState("19:00");
  const [estimatedDeliveryHours, setEstimatedDeliveryHours] = useState("24");
  const [neighborhoodsText, setNeighborhoodsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newNeighborhood, setNewNeighborhood] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && user.role !== "platformAdmin") router.replace("/");
  }, [user, router]);

  function refresh() {
    apiClient.getRegions({ includeInactive: true }).then(setRegions);
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const neighborhoods = neighborhoodsText
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter(Boolean);
    await apiClient.createRegion({
      name,
      cutoffTime,
      estimatedDeliveryHours: Number(estimatedDeliveryHours),
      neighborhoods,
      active: true,
    });
    setName("");
    setNeighborhoodsText("");
    setShowForm(false);
    setSubmitting(false);
    refresh();
  }

  async function addNeighborhood(region: DeliveryRegion) {
    const value = newNeighborhood[region.id]?.trim();
    if (!value) return;
    await apiClient.updateRegion(region.id, { neighborhoods: [...region.neighborhoods, value] });
    setNewNeighborhood((prev) => ({ ...prev, [region.id]: "" }));
    refresh();
  }

  async function removeNeighborhood(region: DeliveryRegion, neighborhood: string) {
    await apiClient.updateRegion(region.id, { neighborhoods: region.neighborhoods.filter((n) => n !== neighborhood) });
    refresh();
  }

  async function toggleActive(region: DeliveryRegion) {
    await apiClient.updateRegion(region.id, { active: !region.active });
    refresh();
  }

  if (user?.role !== "platformAdmin") return null;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Roteirização</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700"
        >
          {showForm ? "Cancelar" : "+ Nova zona de entrega"}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        A região de cada cliente é resolvida automaticamente pelo bairro do endereço — cadastre aqui quais bairros
        cada zona atende. Cliente com bairro fora de qualquer zona fica sem cobertura até você adicionar aqui.
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da zona</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Horário de corte</label>
              <input
                type="time"
                required
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prazo de entrega (horas)</label>
              <input
                type="number"
                required
                value={estimatedDeliveryHours}
                onChange={(e) => setEstimatedDeliveryHours(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bairros atendidos</label>
            <textarea
              value={neighborhoodsText}
              onChange={(e) => setNeighborhoodsText(e.target.value)}
              rows={3}
              placeholder="Um por linha ou separado por vírgula: Boa Viagem, Pina, Imbiribeira"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" disabled={submitting} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
            Salvar zona
          </button>
        </form>
      )}

      <div className="space-y-4">
        {regions.map((region) => (
          <div key={region.id} className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-slate-900">{region.name}</h2>
                <p className="text-xs text-slate-500">
                  Corte {region.cutoffTime} · entrega em {region.estimatedDeliveryHours}h
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(region)}
                className={`text-xs px-2 py-0.5 rounded-full ${region.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
              >
                {region.active ? "Ativa" : "Inativa"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {region.neighborhoods.map((n) => (
                <span key={n} className="flex items-center gap-1 bg-brand-50 text-brand-700 text-xs font-medium px-2 py-1 rounded-full">
                  {n}
                  <button type="button" onClick={() => removeNeighborhood(region, n)} className="text-brand-400 hover:text-brand-700">
                    ✕
                  </button>
                </span>
              ))}
              {region.neighborhoods.length === 0 && <p className="text-xs text-slate-400">Nenhum bairro cadastrado ainda.</p>}
            </div>

            <div className="flex gap-2 max-w-sm">
              <input
                value={newNeighborhood[region.id] ?? ""}
                onChange={(e) => setNewNeighborhood((prev) => ({ ...prev, [region.id]: e.target.value }))}
                placeholder="Adicionar bairro"
                className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => addNeighborhood(region)}
                className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 hover:bg-brand-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        ))}
        {regions.length === 0 && <p className="text-sm text-slate-500">Nenhuma zona cadastrada ainda.</p>}
      </div>
    </AdminShell>
  );
}
