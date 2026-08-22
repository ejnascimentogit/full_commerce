"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, unitPriceOf, calculateShipping } from "@ecommerce/api-client";
import type { Address, Product } from "@ecommerce/types";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

type PaymentMethod = "card" | "pix";

export default function CheckoutPage() {
  const { lines, clear } = useCart();
  const { customer, loading: authLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Record<string, Product>>({});
  const [addressId, setAddressId] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !customer) {
      router.replace("/conta/entrar?redirect=/checkout");
    }
  }, [authLoading, customer, router]);

  useEffect(() => {
    if (!customer) return;
    setAddressId(customer.addresses.find((a) => a.isDefault)?.id ?? customer.addresses[0]?.id ?? "");
    Promise.all(lines.map((l) => apiClient.getProduct(l.productId))).then((items) =>
      setProducts(Object.fromEntries(items.map((p) => [p.id, p]))),
    );
  }, [customer, lines]);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-slate-600">Seu carrinho está vazio.</p>
      </div>
    );
  }

  if (!customer) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500">Carregando...</div>;
  }

  const subtotal = lines.reduce((sum, l) => {
    const p = products[l.productId];
    return p ? sum + unitPriceOf(p) * l.quantity : sum;
  }, 0);
  const shipping = calculateShipping(customer);
  const total = subtotal + shipping;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const order = await apiClient.createOrder({
        customerId: customer!.id,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        addressId,
        paymentMethod: method,
        installments: method === "card" ? installments : undefined,
      });
      clear();
      router.push(`/pedido/${order.id}`);
    } catch {
      setError("Não foi possível confirmar o pedido. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Finalizar compra</h1>

      <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">1. Endereço de entrega</h2>
        <div className="space-y-2">
          {customer.addresses.map((address: Address) => (
            <label
              key={address.id}
              className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer ${addressId === address.id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}
            >
              <input
                type="radio"
                name="address"
                checked={addressId === address.id}
                onChange={() => setAddressId(address.id)}
                className="mt-1"
              />
              <span className="text-sm text-slate-700">
                {address.street}, {address.number} {address.complement && `- ${address.complement}`} —{" "}
                {address.neighborhood}, {address.city}/{address.state} — {address.zipCode}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">2. Forma de pagamento</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setMethod("pix")}
            className={`flex-1 border rounded-md py-3 font-medium ${method === "pix" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}
          >
            PIX
          </button>
          <button
            type="button"
            onClick={() => setMethod("card")}
            className={`flex-1 border rounded-md py-3 font-medium ${method === "card" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}
          >
            Cartão de crédito
          </button>
        </div>

        {method === "card" && (
          <div className="mt-3">
            <label className="block text-sm text-slate-600 mb-1">3. Condição de pagamento</label>
            <select
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              {[1, 2, 3, 6, 12].map((n) => (
                <option key={n} value={n}>
                  {n}x de R$ {(total / n).toFixed(2).replace(".", ",")} {n === 1 ? "à vista" : "sem juros"}
                </option>
              ))}
            </select>
          </div>
        )}
        {method === "pix" && (
          <p className="mt-3 text-sm text-slate-500">
            O QR Code e o código copia-e-cola são gerados na confirmação, junto com o gateway de pagamento do banco.
          </p>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">Resumo</h2>
        <div className="text-sm space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Frete</span>
            <span className={shipping === 0 ? "text-green-600 font-medium" : ""}>
              {shipping === 0 ? "Grátis (CNPJ)" : `R$ ${shipping.toFixed(2).replace(".", ",")}`}
            </span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
            <span>Total</span>
            <span>R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>
      </section>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={submitting || !addressId}
        className="w-full bg-brand-600 text-white font-semibold rounded-md py-3 hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Confirmando..." : "Confirmar pedido"}
      </button>
    </div>
  );
}
