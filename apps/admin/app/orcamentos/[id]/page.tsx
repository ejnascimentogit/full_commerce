"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, PAYMENT_METHOD_LABEL, PAYMENT_METHOD_ORDER } from "@ecommerce/api-client";
import type { Customer, PaymentMethod, Quote, StoreSettings } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { QUOTE_STATUS_BADGE, QUOTE_STATUS_LABEL } from "@/lib/quote-status";

export default function OrcamentoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  const [quotedTotal, setQuotedTotal] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [responding, setResponding] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);

  const [addressId, setAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState(1);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  function load() {
    apiClient.getAdminQuotes().then((quotes) => setQuote(quotes.find((q) => q.id === id) ?? null));
  }

  useEffect(load, [id]);

  useEffect(() => {
    apiClient.getStoreSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (!quote) return;
    setResponseNote(quote.responseNote ?? "");
    setQuotedTotal(quote.quotedTotal != null ? String(quote.quotedTotal) : "");
    apiClient.getAdminCustomers().then((customers) => {
      const found = customers.find((c) => c.id === quote.customerId) ?? null;
      setCustomer(found);
      setAddressId(quote.addressId ?? found?.addresses.find((a) => a.isDefault)?.id ?? found?.addresses[0]?.id ?? "");
    });
  }, [quote]);

  if (quote === undefined) {
    return (
      <AdminShell>
        <p className="text-slate-500">Carregando...</p>
      </AdminShell>
    );
  }

  if (quote === null) {
    return (
      <AdminShell>
        <p className="text-slate-500">Orcamento nao encontrado.</p>
        <Link href="/orcamentos" className="text-sm text-brand-600 hover:underline">
          {"<- Voltar para orcamentos"}
        </Link>
      </AdminShell>
    );
  }

  async function handleRespond(status: "quoted" | "rejected") {
    setResponding(true);
    setResponseError(null);
    try {
      const patch: Partial<{ status: "quoted" | "rejected"; quotedTotal: number; responseNote: string }> = { status, responseNote };
      if (status === "quoted") patch.quotedTotal = Number(quotedTotal) || 0;
      const updated = await apiClient.respondAdminQuote(id, patch);
      setQuote(updated);
    } catch {
      setResponseError("Nao foi possivel salvar a resposta. Tente novamente.");
    } finally {
      setResponding(false);
    }
  }

  async function handleAcceptOnBehalfOfCustomer() {
    setResponding(true);
    setResponseError(null);
    try {
      const updated = await apiClient.respondAdminQuote(id, { status: "accepted" });
      setQuote(updated);
    } catch {
      setResponseError("Nao foi possivel aceitar este orcamento. Tente novamente.");
    } finally {
      setResponding(false);
    }
  }

  async function handleConvert() {
    setConverting(true);
    setConvertError(null);
    try {
      const order = await apiClient.convertAdminQuoteToOrder(id, {
        addressId,
        paymentMethod,
        installments: paymentMethod === "credit" ? installments : undefined,
      });
      router.push(`/pedidos/${order.id}`);
    } catch {
      setConvertError("Nao foi possivel converter o orcamento em pedido. Tente novamente.");
      setConverting(false);
    }
  }

  const availableMethods = settings?.enabledPaymentMethods?.length ? settings.enabledPaymentMethods : PAYMENT_METHOD_ORDER;

  return (
    <AdminShell>
      <Link href="/orcamentos" className="text-sm text-brand-600 hover:underline">
        {"<- Voltar para orcamentos"}
      </Link>
      <div className="flex items-center justify-between mb-1 mt-2">
        <h1 className="text-2xl font-bold text-slate-900">{quote.quoteNumber}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${QUOTE_STATUS_BADGE[quote.status]}`}>{QUOTE_STATUS_LABEL[quote.status]}</span>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        {customer?.name ?? "Cliente"} - pedido em {new Date(quote.createdAt).toLocaleDateString("pt-BR")}
      </p>

      {quote.note && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-semibold text-slate-900 mb-1">Observacao do cliente</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{quote.note}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">Itens</h2>
        <div className="divide-y divide-slate-100 text-sm">
          {quote.items.map((item, i) => (
            <div key={item.productId} className="py-2.5 flex justify-between items-center gap-3">
              <span className="w-6 shrink-0 text-slate-400 font-mono text-xs">{i + 1}.</span>
              <div className="flex-1">
                <p className="text-slate-900">{item.name}</p>
                <p className="text-slate-500">
                  {item.quantity} {item.unitType}
                  {item.referenceUnitPrice != null && (
                    <> x R$ {item.referenceUnitPrice.toFixed(2).replace(".", ",")}/{item.unitType} (referencia)</>
                  )}
                </p>
              </div>
              {item.referenceUnitPrice != null && (
                <p className="font-medium text-slate-900">R$ {(item.referenceUnitPrice * item.quantity).toFixed(2).replace(".", ",")}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {(quote.status === "requested" || quote.status === "quoted") && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-semibold text-slate-900 mb-3">Responder orcamento</h2>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor cotado (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={quotedTotal}
                onChange={(e) => setQuotedTotal(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">Observacao (opcional)</label>
            <textarea
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              placeholder="Ex: condicao de entrega, motivo da recusa..."
            />
          </div>
          {responseError && <p className="text-red-600 text-xs mb-2">{responseError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleRespond("quoted")}
              disabled={responding || !quotedTotal}
              className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {responding ? "Salvando..." : "Enviar cotacao"}
            </button>
            <button
              type="button"
              onClick={() => handleRespond("rejected")}
              disabled={responding}
              className="bg-white border border-red-300 text-red-700 font-semibold rounded-md px-4 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
            >
              Recusar orcamento
            </button>
            {quote.status === "quoted" && (
              <button
                type="button"
                onClick={handleAcceptOnBehalfOfCustomer}
                disabled={responding}
                className="bg-white border border-brand-200 text-brand-700 font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-50 disabled:opacity-50"
                title="Use quando o cliente ja confirmou por telefone/WhatsApp que aceita o valor cotado"
              >
                Aceitar em nome do cliente
              </button>
            )}
          </div>
        </div>
      )}

      {quote.status === "accepted" && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-semibold text-slate-900 mb-3">Converter em pedido</h2>
          {!quote.addressId && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3">
              O cliente ainda nao confirmou um endereco para este orcamento - escolha um abaixo pra converter em nome dele.
            </p>
          )}
          <div className="mb-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">Endereco de entrega</label>
            <select value={addressId} onChange={(e) => setAddressId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">Selecione um endereco</option>
              {customer?.addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.street}, {a.number} - {a.neighborhood}, {a.city}/{a.state}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 flex-wrap mb-3">
            {availableMethods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 min-w-[8rem] border rounded-md py-2.5 font-medium text-sm ${paymentMethod === m ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}
              >
                {PAYMENT_METHOD_LABEL[m]}
              </button>
            ))}
          </div>
          {paymentMethod === "credit" && settings && (
            <select
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-3"
            >
              {Array.from({ length: settings.maxInstallments }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          )}
          {convertError && <p className="text-red-600 text-xs mb-2">{convertError}</p>}
          <button
            type="button"
            onClick={handleConvert}
            disabled={converting || !addressId}
            className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {converting ? "Convertendo..." : "Converter em pedido"}
          </button>
        </div>
      )}

      {quote.status === "converted" && quote.convertedOrderId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-4">
          <p className="text-sm text-green-800 mb-2">Este orcamento ja foi convertido em pedido.</p>
          <Link href={`/pedidos/${quote.convertedOrderId}`} className="text-brand-600 font-medium hover:underline text-sm">
            {"Ver pedido ->"}
          </Link>
        </div>
      )}

      {(quote.status === "rejected" || quote.status === "expired") && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 mb-4 text-sm text-red-700">
          Este orcamento esta {quote.status === "rejected" ? "recusado" : "expirado"}.
          {quote.responseNote && <p className="mt-1 whitespace-pre-wrap">{quote.responseNote}</p>}
        </div>
      )}
    </AdminShell>
  );
}
