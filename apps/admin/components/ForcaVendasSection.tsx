"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";

// Configurações -> Força de vendas: padrão da empresa para a faixa de preço do Novo pedido (proteção de markup). Cada
// produto pode ter limite próprio no cadastro; sem ele, vale este. 0% e 0% = o vendedor não muda o preço.
export function ForcaVendasSection() {
  const [discount, setDiscount] = useState("");
  const [surcharge, setSurcharge] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    apiClient
      .getSalesPricing()
      .then((p) => {
        if (!p) return;
        setDiscount(String(p.maxDiscountPercent));
        setSurcharge(String(p.maxSurchargePercent));
      })
      .catch(() => setMessage({ ok: false, text: "Não deu para carregar os limites." }));
  }, []);

  const toPct = (v: string) => Math.max(0, Math.min(100, Number(v.replace(",", ".")) || 0));
  const example = 100;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const saved = await apiClient.updateSalesPricing({ maxDiscountPercent: toPct(discount), maxSurchargePercent: toPct(surcharge) });
      setDiscount(String(saved.maxDiscountPercent));
      setSurcharge(String(saved.maxSurchargePercent));
      setMessage({ ok: true, text: "Limites salvos." });
    } catch {
      setMessage({ ok: false, text: "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-white border border-slate-200 shadow-md rounded-lg p-5 mt-6 max-w-xl">
      <h2 className="font-semibold text-slate-900 mb-1">Força de vendas: faixa de preço</h2>
      <p className="text-sm text-slate-500 mb-4">
        Quanto o vendedor pode baixar (desconto) ou subir (acréscimo) o preço de tabela ao digitar pedido. Protege o markup e evita
        preço abusivo. Vale para todos os produtos, menos os que têm limite próprio no cadastro.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="block font-medium text-slate-700 mb-1">Desconto máximo (%)</span>
          <input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="block font-medium text-slate-700 mb-1">Acréscimo máximo (%)</span>
          <input inputMode="decimal" value={surcharge} onChange={(e) => setSurcharge(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </label>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Exemplo: produto de R$ {example},00 → o vendedor pode vender entre R$ {(example * (1 - toPct(discount) / 100)).toFixed(2).replace(".", ",")} e R${" "}
        {(example * (1 + toPct(surcharge) / 100)).toFixed(2).replace(".", ",")}. Com 0% e 0%, o preço fica travado na tabela.
      </p>
      <div className="flex items-center gap-3 mt-4">
        <button type="submit" disabled={saving} className="bg-brand-600 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-brand-700 disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar limites"}
        </button>
        {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</span>}
      </div>
    </form>
  );
}
