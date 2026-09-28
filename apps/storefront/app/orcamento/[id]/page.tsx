"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, PAYMENT_METHOD_LABEL, PAYMENT_METHOD_ORDER } from "@ecommerce/api-client";
import type { Address, Category, PaymentMethod, Quote, StoreSettings } from "@ecommerce/types";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { useAuth } from "@/lib/auth-context";
import { QUOTE_STATUS_BADGE, QUOTE_STATUS_LABEL } from "@/lib/quote-status";

function referenceTotal(quote: Quote): number {
  return quote.items.reduce((sum, item) => sum + (item.referenceUnitPrice ?? 0) * item.quantity, 0);
}

export default function OrcamentoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { customer, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  const [addressChoice, setAddressChoice] = useState<string>("");
  const [addingNewAddress, setAddingNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ street: "", number: "", complement: "", neighborhood: "", city: "", state: "", zipCode: "" });
  const [confirmingAddress, setConfirmingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState(1);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!authLoading && !customer) {
      router.replace(`/conta/entrar?redirect=/orcamento/${id}`);
    }
  }, [authLoading, customer, router, id]);

  useEffect(() => {
    if (!customer) return;
    apiClient.getQuotes().then((quotes) => {
      setQuote(quotes.find((q) => q.id === id) ?? null);
    });
  }, [customer, id]);

  useEffect(() => {
    apiClient.getStoreSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (customer && !addressChoice) {
      setAddressChoice(customer.addresses.find((a) => a.isDefault)?.id ?? customer.addresses[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- so define o valor inicial uma vez
  }, [customer]);

  if (authLoading || !customer || quote === undefined) {
    return (
      <>
        <RegionBar />
        <Header categories={categories} />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Carregando orcamento...</div>
      </>
    );
  }

  if (quote === null) {
    return (
      <>
        <RegionBar />
        <Header categories={categories} />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-slate-600">Orcamento nao encontrado.</p>
          <Link href="/conta/orcamentos" className="mt-3 inline-block text-brand-600 font-medium hover:underline">
            Ver meus orcamentos
          </Link>
        </div>
      </>
    );
  }

  async function handleConfirmAddress() {
    setConfirmingAddress(true);
    setAddressError(null);
    try {
      const updated = addingNewAddress
        ? await apiClient.confirmQuoteAddress(id, { address: { ...newAddress, isDefault: false } })
        : await apiClient.confirmQuoteAddress(id, { addressId: addressChoice });
      setQuote(updated);
    } catch {
      setAddressError("Nao foi possivel confirmar o endereco. Tente novamente.");
    } finally {
      setConfirmingAddress(false);
    }
  }

  async function handleConvert() {
    setConverting(true);
    setConvertError(null);
    try {
      const order = await apiClient.convertQuoteToOrder(id, {
        paymentMethod,
        installments: paymentMethod === "credit" ? installments : undefined,
      });
      router.push(`/pedido/${order.id}`);
    } catch {
      setConvertError("Nao foi possivel converter o orcamento em pedido. Tente novamente.");
      setConverting(false);
    }
  }

  const availableMethods = settings?.enabledPaymentMethods?.length ? settings.enabledPaymentMethods : PAYMENT_METHOD_ORDER;

  return (
    <>
      <RegionBar />
      <Header categories={categories} />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-slate-900">Orcamento {quote.quoteNumber}</h1>
          <Link href="/conta/orcamentos" className="text-sm text-brand-600 hover:underline">
            Meus orcamentos
          </Link>
        </div>
        <p className="text-sm text-slate-500 mb-6">Pedido em {new Date(quote.createdAt).toLocaleDateString("pt-BR")}</p>

        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${QUOTE_STATUS_BADGE[quote.status]}`}>
              {QUOTE_STATUS_LABEL[quote.status]}
            </span>
          </div>
          {quote.quotedTotal != null && (
            <div className="text-right">
              <p className="text-sm text-slate-500">Valor cotado</p>
              <p className="text-xl font-bold text-slate-900">R$ {quote.quotedTotal.toFixed(2).replace(".", ",")}</p>
            </div>
          )}
        </section>

        {quote.note && (
          <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
            <h2 className="font-semibold text-slate-900 mb-1">Sua observacao</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{quote.note}</p>
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
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
                  <p className="font-medium text-slate-900">
                    R$ {(item.referenceUnitPrice * item.quantity).toFixed(2).replace(".", ",")}
                  </p>
                )}
              </div>
            ))}
          </div>
          {quote.quotedTotal == null && (
            <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-sm font-semibold text-slate-900">
              <span>Total de referencia</span>
              <span>R$ {referenceTotal(quote).toFixed(2).replace(".", ",")}</span>
            </div>
          )}
        </section>

        {quote.responseNote && (
          <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
            <h2 className="font-semibold text-slate-900 mb-1">Retorno do vendedor</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{quote.responseNote}</p>
          </section>
        )}

        {quote.status === "requested" && (
          <section className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-4 text-sm text-slate-600">
            Aguardando resposta do vendedor com o valor deste orcamento.
          </section>
        )}

        {quote.status === "quoted" && (
          <section className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-4">
            <p className="text-sm text-amber-800 font-medium mb-1">Orcamento cotado - aguardando sua confirmacao</p>
            <p className="text-sm text-amber-700">
              Fale com nossa equipe (telefone ou WhatsApp) pra confirmar se aceita este valor. Assim que a equipe confirmar por la, este
              orcamento libera aqui o endereco de entrega e a conversao em pedido.
            </p>
          </section>
        )}

        {quote.status === "accepted" && !quote.addressId && (
          <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
            <h2 className="font-semibold text-slate-900 mb-3">Endereco de entrega</h2>
            {customer.addresses.length > 0 && !addingNewAddress && (
              <div className="space-y-2 mb-3">
                {customer.addresses.map((address: Address) => (
                  <label
                    key={address.id}
                    className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer ${addressChoice === address.id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}
                  >
                    <input
                      type="radio"
                      name="quote-address"
                      checked={addressChoice === address.id}
                      onChange={() => setAddressChoice(address.id)}
                      className="mt-1"
                    />
                    <span className="text-sm text-slate-700">
                      {address.label && <span className="font-medium text-slate-500">{address.label}: </span>}
                      {address.street}, {address.number} {address.complement && `- ${address.complement}`} - {address.neighborhood},{" "}
                      {address.city}/{address.state} - {address.zipCode}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {addingNewAddress ? (
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <input
                  placeholder="Rua"
                  value={newAddress.street}
                  onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  placeholder="Numero"
                  value={newAddress.number}
                  onChange={(e) => setNewAddress({ ...newAddress, number: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder="Complemento (opcional)"
                  value={newAddress.complement}
                  onChange={(e) => setNewAddress({ ...newAddress, complement: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder="Bairro"
                  value={newAddress.neighborhood}
                  onChange={(e) => setNewAddress({ ...newAddress, neighborhood: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder="CEP"
                  value={newAddress.zipCode}
                  onChange={(e) => setNewAddress({ ...newAddress, zipCode: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder="Cidade"
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  placeholder="UF"
                  maxLength={2}
                  value={newAddress.state}
                  onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value.toUpperCase() })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm uppercase"
                />
                <button
                  type="button"
                  onClick={() => setAddingNewAddress(false)}
                  className="text-sm text-slate-500 hover:text-slate-700 sm:col-span-2 text-left"
                >
                  {"<- Escolher um endereco ja cadastrado"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingNewAddress(true)} className="text-sm text-brand-600 font-medium hover:underline mb-3">
                + Usar um endereco novo
              </button>
            )}

            {addressError && <p className="text-red-600 text-xs mb-2">{addressError}</p>}
            <button
              type="button"
              onClick={handleConfirmAddress}
              disabled={confirmingAddress || (addingNewAddress ? !newAddress.street || !newAddress.number : !addressChoice)}
              className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {confirmingAddress ? "Confirmando..." : "Confirmar endereco"}
            </button>
          </section>
        )}

        {quote.status === "accepted" && quote.addressId && (
          <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
            <h2 className="font-semibold text-slate-900 mb-3">Converter em pedido</h2>
            <div className="flex gap-3 flex-wrap mb-3">
              {availableMethods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 min-w-[8rem] border rounded-md py-3 font-medium ${paymentMethod === m ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}
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
              disabled={converting}
              className="w-full bg-brand-600 text-white font-semibold rounded-md py-3 hover:bg-brand-700 disabled:opacity-50"
            >
              {converting ? "Convertendo..." : "Converter em pedido"}
            </button>
          </section>
        )}

        {quote.status === "converted" && quote.convertedOrderId && (
          <section className="bg-green-50 border border-green-200 rounded-lg p-5 mb-4">
            <p className="text-sm text-green-800 mb-2">Este orcamento ja foi convertido em pedido.</p>
            <Link href={`/pedido/${quote.convertedOrderId}`} className="text-brand-600 font-medium hover:underline text-sm">
              {"Ver pedido ->"}
            </Link>
          </section>
        )}

        {(quote.status === "rejected" || quote.status === "expired") && (
          <section className="bg-red-50 border border-red-200 rounded-lg p-5 mb-4 text-sm text-red-700">
            Este orcamento foi {quote.status === "rejected" ? "recusado" : "expirado"} e nao pode mais receber acoes.
          </section>
        )}
      </div>
    </>
  );
}
