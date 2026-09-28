"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { Category, Quote } from "@ecommerce/types";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { useAuth } from "@/lib/auth-context";
import { QUOTE_STATUS_BADGE, QUOTE_STATUS_LABEL } from "@/lib/quote-status";

function quoteTotal(quote: Quote): number {
  if (quote.quotedTotal != null) return quote.quotedTotal;
  return quote.items.reduce((sum, item) => sum + (item.referenceUnitPrice ?? 0) * item.quantity, 0);
}

export default function MeusOrcamentosPage() {
  const { customer, loading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);

  useEffect(() => {
    apiClient.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!loading && !customer) {
      router.replace("/conta/entrar?redirect=/conta/orcamentos");
      return;
    }
    if (customer) apiClient.getQuotes().then(setQuotes);
  }, [loading, customer, router]);

  if (loading || !customer) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Carregando...</div>;
  }

  return (
    <>
      <RegionBar />
      <Header categories={categories} />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Meus orcamentos</h1>

        {quotes?.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
            <p className="text-slate-600">Voce ainda nao pediu nenhum orcamento.</p>
            <Link href="/carrinho" className="mt-3 inline-block text-brand-600 font-medium hover:underline">
              Ir para o carrinho
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {quotes?.map((quote) => (
            <Link
              key={quote.id}
              href={`/orcamento/${quote.id}`}
              className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-brand-300"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{quote.quoteNumber}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${QUOTE_STATUS_BADGE[quote.status]}`}>
                  {QUOTE_STATUS_LABEL[quote.status]}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{new Date(quote.createdAt).toLocaleDateString("pt-BR")}</p>
              <p className="text-sm text-slate-600 mt-2">
                {quote.items.length} {quote.items.length === 1 ? "item" : "itens"} - R$ {quoteTotal(quote).toFixed(2).replace(".", ",")}
                {quote.quotedTotal == null && <span className="text-slate-400"> (referencia)</span>}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
