"use client";

import { CollapsibleSection } from "./CollapsibleSection";
import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";
import type { AdminUser, StoreSettings } from "@ecommerce/types";

type ModoAtribuicao = StoreSettings["atividadeAutoModoAtribuicao"];

const MODO_LABEL: Record<ModoAtribuicao, string> = {
  manual: "Deixar sem responsavel (time decide depois)",
  vendedor_vinculado: "Vendedor vinculado ao cliente",
  round_robin_todos: "Rodizio entre todos os atendentes",
  round_robin_subconjunto: "Rodizio entre atendentes selecionados",
};

const MODO_ORDER: ModoAtribuicao[] = ["manual", "vendedor_vinculado", "round_robin_todos", "round_robin_subconjunto"];

export function AtividadesAutomaticasSection() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [staff, setStaff] = useState<AdminUser[]>([]);

  const [ativo, setAtivo] = useState(false);
  const [clienteInativoDias, setClienteInativoDias] = useState("30");
  const [cadastroSemCompraDias, setCadastroSemCompraDias] = useState("15");
  const [modoAtribuicao, setModoAtribuicao] = useState<ModoAtribuicao>("round_robin_todos");
  const [subconjuntoIds, setSubconjuntoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function refresh() {
    apiClient.getStoreSettings().then((s) => {
      setSettings(s);
      setAtivo(s.atividadeAutoAtivo);
      setClienteInativoDias(s.atividadeAutoClienteInativoDias.toString());
      setCadastroSemCompraDias(s.atividadeAutoCadastroSemCompraDias.toString());
      setModoAtribuicao(s.atividadeAutoModoAtribuicao);
      setSubconjuntoIds(s.atividadeAutoSubconjuntoIds ?? []);
    });
    apiClient.getTeamMembers().then(setStaff);
  }

  useEffect(refresh, []);

  const atendentesElegiveis = staff.filter((m) => (m.active ?? true) && (m.permissions ?? []).includes("atividades"));

  function toggleSubconjunto(id: string) {
    setSubconjuntoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    await apiClient.updateStoreSettings({
      atividadeAutoAtivo: ativo,
      atividadeAutoClienteInativoDias: Number(clienteInativoDias),
      atividadeAutoCadastroSemCompraDias: Number(cadastroSemCompraDias),
      atividadeAutoModoAtribuicao: modoAtribuicao,
      atividadeAutoSubconjuntoIds: modoAtribuicao === "round_robin_subconjunto" ? subconjuntoIds : undefined,
    });
    setSaving(false);
    refresh();
  }

  if (!settings) return null;

  return (
    <CollapsibleSection expandKey="atividades-automaticas" title="Atividades Automaticas" className="bg-white border border-slate-200 shadow-md rounded-lg p-5 mt-6 max-w-2xl">
      <p className="text-sm text-slate-500 mb-4">
        Gera cards em Atividades sozinho, todo dia, a partir de 3 situacoes: orcamento parado (criado e nao virou pedido ate o dia seguinte), cliente
        que ja comprou mas sumiu, e cliente cadastrado que nunca comprou. Sem isso ligado, ninguem precisa lembrar de checar essas situacoes na mao.
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Ativar geracao automatica de atividades</p>
            <p className="text-xs text-slate-500 mt-0.5">Desligado (padrao), nenhum card automatico e criado -- o quadro continua 100% manual.</p>
          </div>
          <button
            type="button"
            onClick={() => setAtivo((v) => !v)}
            className={`shrink-0 ml-4 relative w-12 h-7 rounded-full transition-colors ${ativo ? "bg-brand-600" : "bg-slate-300"}`}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${ativo ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dias sem compra para considerar cliente inativo</label>
            <input
              type="number"
              min={1}
              value={clienteInativoDias}
              onChange={(e) => setClienteInativoDias(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Cliente que ja comprou antes, mas nao compra ha esse tanto de dias.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dias sem compra apos o cadastro</label>
            <input
              type="number"
              min={1}
              value={cadastroSemCompraDias}
              onChange={(e) => setCadastroSemCompraDias(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Cliente que nunca comprou, cadastrado ha esse tanto de dias.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Como atribuir os cards gerados</label>
          <select
            value={modoAtribuicao}
            onChange={(e) => setModoAtribuicao(e.target.value as ModoAtribuicao)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            {MODO_ORDER.map((m) => (
              <option key={m} value={m}>
                {MODO_LABEL[m]}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Vale igualmente para os 3 gatilhos acima.</p>
        </div>

        {modoAtribuicao === "round_robin_subconjunto" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Atendentes que entram no rodizio</label>
            <div className="flex flex-wrap gap-2">
              {atendentesElegiveis.map((m) => {
                const checked = subconjuntoIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleSubconjunto(m.id)}
                    className={`text-sm font-medium rounded-full px-3 py-1.5 border ${
                      checked ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-300 text-slate-500"
                    }`}
                  >
                    {checked ? "OK " : ""}
                    {m.name}
                  </button>
                );
              })}
              {atendentesElegiveis.length === 0 && (
                <p className="text-xs text-slate-400">
                  Nenhum atendente ativo com acesso a aba Atividades ainda -- cadastre em "Equipe" e marque a permissao "Atividades".
                </p>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              So aparecem aqui atendentes ativos com acesso a aba Atividades -- so eles podem receber card no rodizio.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-5 bg-brand-600 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </CollapsibleSection>
  );
}
