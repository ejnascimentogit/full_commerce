"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  apiClient,
  unitPriceOf,
  calculateShipping,
  calculatePromotionDiscount,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHOD_ORDER,
} from "@ecommerce/api-client";
import type { Address, Category, PaymentMethod, Product, Promotion, StoreSettings } from "@ecommerce/types";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

// CRC16-CCITT (poly 0x1021, init 0xFFFF) — checksum exigido no final de todo
// payload Pix, especificação do Bacen (BR Code / EMV QR).
function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

const COMBINING_MARKS = new RegExp(`[̀-ͯ]`, "g");
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "");
}

// Pix estático (chave + valor fixo, sem depender de nenhum gateway/API) — o
// próprio app do banco de quem escaneia lê os dados direto do QR e paga na
// chave configurada em Configurações > Pagamento.
function buildStaticPixPayload(pixKey: string, receiverName: string, receiverCity: string, amount: number): string {
  const merchantAccountInfo = tlv("26", tlv("00", "BR.GOV.BCB.PIX") + tlv("01", pixKey.trim()));
  const name = stripAccents(receiverName || "LOJA").toUpperCase().slice(0, 25) || "LOJA";
  const city = stripAccents(receiverCity || "BRASIL").toUpperCase().slice(0, 15) || "BRASIL";
  const payloadWithoutCrc =
    tlv("00", "01") +
    tlv("01", "11") +
    merchantAccountInfo +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", name) +
    tlv("60", city) +
    tlv("62", tlv("05", "***")) +
    "6304";
  return payloadWithoutCrc + crc16ccitt(payloadWithoutCrc);
}

// Tabela Price (juros compostos padrão do mercado): parcela fixa que
// amortiza o valor presente em n meses à taxa mensal `rate` (decimal).
function priceInstallment(total: number, n: number, rate: number): number {
  if (rate <= 0) return total / n;
  return (total * rate) / (1 - Math.pow(1 + rate, -n));
}

function buildInstallmentOptions(total: number, settings: StoreSettings) {
  const options: { n: number; value: number; hasInterest: boolean }[] = [];
  for (let n = 1; n <= settings.maxInstallments; n++) {
    const hasInterest = n > settings.interestFreeInstallments;
    const value = hasInterest ? priceInstallment(total, n, settings.monthlyInterestRate / 100) : total / n;
    if (value < settings.minInstallmentValue) break;
    options.push({ n, value, hasInterest });
  }
  return options;
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

  // Só escolhe a aba inicial uma vez, quando a loja carrega — depois disso o
  // cliente troca livremente, nunca sobrescrevemos a escolha manual. Usa a
  // condição pré-definida do cliente (cadastrada pelo admin) se ela estiver
  // entre as formas habilitadas pela loja; senão cai na primeira habilitada.
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (appliedDefault.current || !settings) return;
    const enabled = settings.enabledPaymentMethods?.length ? settings.enabledPaymentMethods : PAYMENT_METHOD_ORDER;
    const preferred = customer?.preferredPaymentMethod;
    setMethod(preferred && enabled.includes(preferred) ? preferred : enabled[0]);
    appliedDefault.current = true;
  }, [settings, customer]);

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
    if (amount <= 0 || !settings.pixKey) {
      setPixQrDataUrl(null);
      return;
    }
    const code = buildStaticPixPayload(settings.pixKey, settings.pixReceiverName ?? "", settings.pixReceiverCity ?? "", amount);
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

  const availableMethods = PAYMENT_METHOD_ORDER.filter((m) => settings.enabledPaymentMethods?.includes(m) ?? true);

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
        installments: method === "credit" ? installments : undefined,
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">2. Forma de pagamento</h2>
          {customer.preferredPaymentMethod && (
            <span className="text-xs font-medium bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
              🏷️ Preferência: {PAYMENT_METHOD_LABEL[customer.preferredPaymentMethod]}
            </span>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          {availableMethods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`flex-1 min-w-[8rem] border rounded-md py-3 font-medium ${method === m ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}
            >
              {PAYMENT_METHOD_LABEL[m]}
            </button>
          ))}
        </div>

        {method === "credit" && (
          <div className="mt-3">
            <label className="block text-sm text-slate-600 mb-1">3. Condição de pagamento</label>
            <select
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              {buildInstallmentOptions(total, settings).map(({ n, value, hasInterest }) => (
                <option key={n} value={n}>
                  {n}x de R$ {value.toFixed(2).replace(".", ",")} {n === 1 ? "à vista (crédito rotativo)" : hasInterest ? "com juros" : "sem juros"}
                </option>
              ))}
            </select>
          </div>
        )}
        {method === "debit" && (
          <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-md px-3 py-2">
            Pagamento à vista no cartão de débito, na entrega/retirada.
          </p>
        )}
        {method === "cash" && (
          <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-md px-3 py-2">
            Pagamento à vista em dinheiro, na entrega/retirada.
          </p>
        )}
        {method === "pix" && (
          <div className="mt-3">
            {!settings.pixKey ? (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                A loja ainda não configurou a chave Pix — fale com o suporte ou escolha outra forma de pagamento.
              </p>
            ) : pixQrDataUrl ? (
              <div className="flex flex-col items-center gap-3 border border-slate-200 rounded-md p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerado em memória, não é um asset otimizável */}
                <img src={pixQrDataUrl} alt="QR Code do PIX" className="w-44 h-44" />
                <p className="text-sm font-semibold text-slate-900">
                  R$ {total.toFixed(2).replace(".", ",")}
                </p>
                {settings.pixReceiverName && (
                  <p className="text-xs text-slate-500 text-center -mt-1.5">
                    Recebedor: <span className="font-medium text-slate-700">{settings.pixReceiverName}</span>
                    {settings.pixReceiverCity ? ` — ${settings.pixReceiverCity}` : ""}
                  </p>
                )}
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
                  Escaneie no app do seu banco ou copie o código — o pagamento cai direto na chave Pix da loja.
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
