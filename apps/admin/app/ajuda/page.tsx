"use client";

import { useState } from "react";
import { ADMIN_FAQ, searchFaq, type FaqEntry } from "@ecommerce/api-client";
import { AdminShell } from "@/components/AdminShell";

// Sem IA, sem chamada de rede pra responder — busca local por palavra-chave numa
// lista curada (packages/api-client/src/faq.ts). Zero custo por pergunta.
export default function AjudaAdminPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FaqEntry | null>(null);
  const [searched, setSearched] = useState(false);

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
    const results = searchFaq(ADMIN_FAQ, query);
    setSelected(results[0] ?? null);
  }

  return (
    <AdminShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Central de Ajuda</h1>
        <p className="text-sm text-slate-500 mb-6">Digite sua dúvida sobre como usar o painel, ou escolha uma pergunta frequente.</p>

        <form onSubmit={handleAsk} className="flex gap-2 mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: como funciona o SKU?"
            className="flex-1 border border-slate-300 rounded-md px-4 py-2.5 text-sm"
          />
          <button type="submit" className="bg-brand-600 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-brand-700">
            Perguntar
          </button>
        </form>

        {searched && (
          <div className="mb-8">
            {selected ? (
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <p className="text-sm font-semibold text-slate-900 mb-1">{selected.question}</p>
                <p className="text-sm text-slate-600">{selected.answer}</p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-800">
                Não encontrei uma resposta pra essa pergunta. Veja se alguma das perguntas frequentes abaixo ajuda.
              </div>
            )}
          </div>
        )}

        <h2 className="text-sm font-semibold text-slate-700 mb-3">Perguntas frequentes</h2>
        <ul className="space-y-2">
          {ADMIN_FAQ.map((entry) => (
            <li key={entry.question}>
              <button
                type="button"
                onClick={() => {
                  setSelected(entry);
                  setSearched(true);
                  setQuery("");
                }}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm ${
                  selected?.question === entry.question
                    ? "bg-brand-50 border-brand-200 text-brand-800"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {entry.question}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AdminShell>
  );
}
