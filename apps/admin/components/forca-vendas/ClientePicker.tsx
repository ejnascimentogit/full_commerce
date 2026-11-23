"use client";

import { useMemo, useState } from "react";
import type { Customer, OrderDraft } from "@ecommerce/types";
import { customerNumber, onlyDigits } from "@ecommerce/api-client";
import { planLabel, shortDate } from "./shared";

// Passo 1: carteira do vendedor. Rascunhos em aberto aparecem primeiro (continuar de onde parou, de qualquer aparelho).
export function ClientePicker({
  customers,
  drafts,
  loading,
  onPick,
  onResumeDraft,
  onDeleteDraft,
}: {
  customers: Customer[];
  drafts: OrderDraft[];
  loading: boolean;
  onPick: (customer: Customer) => void;
  onResumeDraft: (draft: OrderDraft) => void;
  onDeleteDraft: (draft: OrderDraft) => void;
}) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    const digits = onlyDigits(q);
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.businessName ?? "").toLowerCase().includes(q) ||
        customerNumber(c.code).toLowerCase().includes(q) ||
        (digits.length >= 3 && onlyDigits(c.document).includes(digits)),
    );
  }, [customers, query]);

  return (
    <div>
      {drafts.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Rascunhos</h2>
          <ul className="space-y-2">
            {drafts.map((d) => {
              const customer = byId.get(d.customerId);
              return (
                <li key={d.id} className="bg-white border border-amber-300 rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{customer?.name ?? "Cliente fora da carteira"}</p>
                    <p className="text-xs text-slate-500">
                      {d.data.items.length} {d.data.items.length === 1 ? "item" : "itens"} · salvo em {shortDate(d.updatedAt)}
                    </p>
                  </div>
                  {customer && (
                    <button type="button" onClick={() => onResumeDraft(d)} className="text-sm font-medium text-brand-700 px-2 py-1">
                      Continuar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteDraft(d)}
                    className="text-sm text-slate-500 hover:text-red-600 px-2 py-1"
                    aria-label="Excluir rascunho"
                  >
                    Excluir
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome, razão social, código ou CNPJ/CPF"
        className="w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm mb-3"
        autoFocus
      />

      {loading ? (
        <p className="text-sm text-slate-500">Carregando carteira…</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-lg p-4">
          Nenhum cliente na sua carteira ainda. Peça ao administrador para vincular clientes a você em Clientes → editar → Vendedor vinculado.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-2">
            {filtered.length} de {customers.length} clientes
          </p>
          <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {filtered.map((c) => {
              const address = c.addresses.find((a) => a.isDefault) ?? c.addresses[0];
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => onPick(c)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500 w-12 shrink-0">{customerNumber(c.code)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{c.name}</span>
                      {c.businessName && <span className="block text-xs text-slate-500 truncate">{c.businessName}</span>}
                      <span className="block text-xs text-slate-400 truncate">
                        {address ? `${address.neighborhood} · ${address.city}` : "Sem endereço"} · {planLabel(c.preferredPaymentMethod)}
                      </span>
                    </span>
                    {c.status !== "active" && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700">Inativo</span>}
                    <span className="text-slate-400" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
