"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@ecommerce/api-client";
import type { Customer, Quote, QuoteStatus } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { QUOTE_STATUS_BADGE, QUOTE_STATUS_LABEL } from "@/lib/quote-status";

const ALL_STATUSES = Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[];

function quoteTotal(quote: Quote): number {
  if (quote.quotedTotal != null) return quote.quotedTotal;
  return quote.items.reduce((sum, item) => sum + (item.referenceUnitPrice ?? 0) * item.quantity, 0);
}

export default function OrcamentosPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, Customer>>({});
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "">("");

  useEffect(() => {
    apiClient.getAdminQuotes().then(setQuotes);
    apiClient.getAdminCustomers().then((customers) => {
      setCustomersById(Object.fromEntries(customers.map((c) => [c.id, c])));
    });
  }, []);

  const filtered = statusFilter ? quotes.filter((q) => q.status === statusFilter) : quotes;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Orcamentos</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | "")}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Orcamento</th>
              <th className="text-left px-4 py-2.5">Cliente</th>
              <th className="text-left px-4 py-2.5">Data</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Valor</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((quote) => {
              const customer = customersById[quote.customerId];
              return (
                <tr key={quote.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{quote.quoteNumber}</td>
                  <td className="px-4 py-2.5 text-slate-700">{customer?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{new Date(quote.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${QUOTE_STATUS_BADGE[quote.status]}`}>
                      {QUOTE_STATUS_LABEL[quote.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    R$ {quoteTotal(quote).toFixed(2).replace(".", ",")}
                    {quote.quotedTotal == null && <span className="text-slate-400 text-xs"> (ref.)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/orcamentos/${quote.id}`} className="text-brand-600 hover:underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">Nenhum orcamento encontrado.</p>}
      </div>
    </AdminShell>
  );
}
