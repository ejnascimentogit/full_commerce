"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { apiClient, unitPriceOf, calculateShipping, calculatePromotionDiscount } from "@ecommerce/api-client";
import type { Address, Category, Product, Promotion, StoreSettings } from "@ecommerce/types";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

type PaymentMethod = "card" | "pix";

// Sem gateway real integrado ainda — o texto codificado deixa isso explícito
// (não é um payload EMV/Bacen válido) pra nunca passar a impressão de ser um
// PIX de verdade que possa ser escaneado por engano num app de banco.
function buildPixDemoPayload(orderRef: string, amount: number): string {
  return `PIX-DEMO|pedido:${orderRef}|valor:${amount.toFixed(2)}|ambiente:fullcommerce-demo`;
}

export default function CheckoutPage() {
  const { lines, clear } = useCart();
  const { customer, loading: authLoading } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [addressId, setAddressId] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const [pixCode, setPixCode] = useState("");
  const [pixQrDataUrl, setPixQrDataUrl] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !customer) {
      router.replace("/conta/entrar?redirect=/checkout");
    }
  }, [authLoading, customer, router]);

  useEffect(() => {
    apiClient.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!customer) return;
    setAddressId(customer.addresses.find((a) => a.isDefault)?.id ?? customer.addresses[0]?.id ?? "");
    Promise.all([Promise.all(lines.map((l) => apiClient.getProduct(l.productId))), apiClient.getStoreSettings()]).then(
      ([items, s]) => {
        setProducts(Object.fromEntries(items.map((p) => [p.id, p])));
        setSettings(s);
      },
    );
  }, [customer, lines]);

  useEffect(() => {
    if (method !== "pix" || !customer || !settings) {
      setPixQrDataUrl(null);
      return;
    }
    const resolved = lines
      .map((l) => ({ line: l, product: products[l.productId] }))
      .filter((l): l is { line: (typeof lines)[number]; product: Product } => Boolean(l.product));
    if (resolved.length === 0) {
      setPixQrDataUrl(null);
      return;
    }
    const sub = resolved.reduce((sum, { line, product }) => sum + unitPriceOf(product) * line.quantity, 0);
    const isFreeShip = appliedPromotion?.type === "freeShipping";
    const ship = isFreeShip ? 0 : calculateShipping(customer, settings);
    const disc = appliedPromotion
      ? calculatePromotionDiscount(
          appliedPromotion,
          resolved.map(({ line, product }) => ({ product, subtotal: unitPriceOf(product) * line.quantity })),
          sub,
        )
      : 0;
    const amount = Math.max(0, sub - disc) + ship;
    if (amount <= 0) {
      setPixQrDataUrl(null);
      return;
    }
    const code = buildPixDemoPayload(customer.id.slice(0, 8), amount);
    setPixCode(code);
    setPixCopied(false);
    let cancelled = false;
    QRCode.toDataURL(code, { margin: 1, width: 220 }).then((url) => {
      if (!cancelled) setPixQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [method, lines, products, settings, customer, appliedPromotion]);

  if (lines.length === 0) {
    return (
      <>
        <RegionBar />
        <Header categories={categories} />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-slate-600">Seu carrinho está vazio.</p>
        </div>
      </>
    );
  }

  if (!customer || !settings) {
    return (
      <>
        <RegionBar />
        <Header categories={categories} />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500">Carregando...</div>
      </>
    );
  }

  const resolvedLines = lines
    .map((l) => ({ line: l, product: products[l.productId] }))
    .filter((l): l is { line: (typeof lines)[number]; product: Product } => Boolean(l.product));

  const subtotal = resolvedLines.reduce((sum, { line, product }) => sum + unitPriceOf(product) * line.quantity, 0);
  const baseShipping = calculateShipping(customer, settings);
  const belowMinimum = Boolean(settings.minOrderValue && subtotal < settings.minOrderValue);
  const isFreeShippingCoupon = appliedPromotion?.type === "freeShipping";
  const shipping = isFreeShippingCoupon ? 0 : baseShipping;
  const discount = appliedPromotion
    ? calculatePromotionDiscount(
        appliedPromotion,
        resolvedLines.map(({ line, product }) => ({ product, subtotal: unitPriceOf(product) * line.quantity })),
        subtotal,
      )
    : 0;
  const total = Math.max(0, subtotal - discount) + shipping;

  async function handleApplyCoupon() {
    setCheckingCoupon(true);
    setCouponError(null);
    try {
      const promotion = await apiClient.getPromotionByCoupon(couponInput);
      if (!promotion) {
        setCouponError("Cupom inválido, expirado ou promoções estão desativadas no momento.");
        setAppliedPromotion(null);
        return;
      }
      if (promotion.rules.minOrderValue && subtotal < promotion.rules.minOrderValue) {
        setCouponError(`Esse cupom exige pedido mínimo de R$ ${promotion.rules.minOrderValue.toFixed(2).replace(".", ",")}.`);
        setAppliedPromotion(null);
        return;
      }
      setAppliedPromotion(promotion);
    } finally {
      setCheckingCoupon(false);
    }
  }

  function removeCoupon() {
    setAppliedPromotion(null);
    setCouponInput("");
    setCouponError(null);
  }

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
        couponCode: appliedPromotion?.couponCode,
      });
      clear();
      router.push(`/pedido/${order.id}`);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "BELOW_MIN_ORDER_VALUE"
          ? `O pedido mínimo é R$ ${settings!.minOrderValue!.toFixed(2).replace(".", ",")}.`
          : "Não foi possível confirmar o pedido. Tente novamente.",
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <RegionBar />
      <Header categories={categories} />

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
                {address.label && <span className="font-medium text-slate-500">{address.label}: </span>}
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
          <div className="mt-3">
            {pixQrDataUrl ? (
              <div className="flex flex-col items-center gap-3 border border-slate-200 rounded-md p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerado em memória, não é um asset otimizável */}
                <img src={pixQrDataUrl} alt="QR Code do PIX" className="w-44 h-44" />
                <p className="text-sm font-semibold text-slate-900">
                  R$ {total.toFixed(2).replace(".", ",")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pixCode);
                    setPixCopied(true);
                    setTimeout(() => setPixCopied(false), 2000);
                  }}
                  className="text-xs font-medium text-brand-600 border border-brand-200 rounded-md px-3 py-1.5 hover:bg-brand-50"
                >
                  {pixCopied ? "Código copiado!" : "Copiar código PIX"}
                </button>
                <p className="text-xs text-slate-400 text-center">
                  Ambiente de demonstração — QR Code simulado, sem integração real com banco ainda.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Gerando QR Code do PIX...</p>
            )}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">Cupom de desconto</h2>
        {appliedPromotion ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-3 py-2">
            <span className="text-sm text-green-700 font-medium">
              Cupom <span className="font-mono">{appliedPromotion.couponCode}</span> aplicado
              {appliedPromotion.type === "percentage" && ` — ${appliedPromotion.value}% off`}
              {appliedPromotion.type === "freeShipping" && " — frete grátis"}
              {(appliedPromotion.type === "fixed" || appliedPromotion.type === "coupon") &&
                ` — R$ ${appliedPromotion.value.toFixed(2).replace(".", ",")} off`}
            </span>
            <button type="button" onClick={removeCoupon} className="text-green-700 text-sm hover:underline">
              Remover
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="Código do cupom"
              className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={checkingCoupon || !couponInput}
              className="text-brand-600 border border-brand-200 rounded-md px-4 text-sm font-medium hover:bg-brand-50 disabled:opacity-50"
            >
              {checkingCoupon ? "Verificando..." : "Aplicar"}
            </button>
          </div>
        )}
        {couponError && <p className="text-red-600 text-xs mt-2">{couponError}</p>}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">Resumo</h2>
        <div className="text-sm space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Desconto</span>
              <span>− R$ {discount.toFixed(2).replace(".", ",")}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Frete</span>
            <span className={shipping === 0 ? "text-green-600 font-medium" : ""}>
              {shipping === 0 ? (isFreeShippingCoupon ? "Grátis (cupom)" : "Grátis (CNPJ)") : `R$ ${shipping.toFixed(2).replace(".", ",")}`}
            </span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-200">
            <span>Total</span>
            <span>R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>
      </section>

      {belowMinimum && (
        <p className="text-amber-600 text-sm mb-3 bg-amber-50 rounded-md px-3 py-2">
          Faltam R$ {(settings.minOrderValue! - subtotal).toFixed(2).replace(".", ",")} para o pedido mínimo de R${" "}
          {settings.minOrderValue!.toFixed(2).replace(".", ",")}.
        </p>
      )}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting || !addressId || belowMinimum}
          className="flex-1 bg-brand-600 text-white font-semibold rounded-md py-3 hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Confirmando..." : "Confirmar pedido"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/carrinho")}
          disabled={submitting}
          className="text-slate-600 font-medium px-5 py-3 rounded-md hover:bg-slate-100 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      </div>
    </>
  );
}
