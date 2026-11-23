"use client";

import { useMemo, useState } from "react";
import type { AdminUser, Customer, Order, OrderDraft, PaymentMethod, SalesOrderLine, SalesProduct, StoreSettings } from "@ecommerce/types";
import {
  apiClient,
  customerNumber,
  netUnitPrice,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHOD_ORDER,
  salesBasePrice,
  salesLineSubtotal,
  salesOrderAlerts,
  salesOrderTotals,
  userCan,
} from "@ecommerce/api-client";
import { money } from "@/lib/whatsapp";
import { Card, defaultAddressId, planLabel, Tabs } from "./shared";

type PedidoTab = "cabecalho" | "produtos" | "promocoes" | "itens" | "totais" | "alertas";

const UNIT_LABEL: Record<string, string> = { un: "un", kg: "kg", cx: "cx" };

// Mensagens para os códigos que o servidor pode devolver ao enviar (o resto já aparece antes, na aba Alertas).
const SERVER_ERRORS: Record<string, string> = {
  CUSTOMER_NOT_FOUND: "Cliente fora da sua carteira.",
  CUSTOMER_INACTIVE: "Cliente inativo.",
  ADDRESS_NOT_FOUND: "Endereço de entrega inválido.",
  PAYMENT_METHOD_DISABLED: "Forma de pagamento desligada na loja.",
  PLAN_CHANGE_FORBIDDEN: "Você não pode trocar o plano de pagamento do cliente.",
  TOO_MANY_INSTALLMENTS: "Parcelas acima do máximo da loja.",
  EMPTY_ORDER: "Inclua pelo menos um item.",
  PRODUCT_NOT_FOUND: "Um produto saiu de linha. Atualize a tela e tire o item.",
  INVALID_QUANTITY: "Quantidade inválida em um item.",
  DISCOUNT_ABOVE_LIMIT: "Desconto acima do seu limite.",
  BELOW_MIN_ORDER_VALUE: "Pedido abaixo do valor mínimo da loja.",
  FORBIDDEN: "Você não tem permissão para digitar pedidos.",
};

function newDraftId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

// Passo 3: o pedido, em abas como no maxPedido (Cabeçalho, Tabela, Campanhas, Itens, Totais, Alertas). A barra de baixo
// mostra o total e as ações em qualquer aba. Tudo que bloqueia o envio aparece em Alertas antes; o servidor confere de novo.
export function PedidoEditor({
  user,
  customer,
  settings,
  products,
  draft,
  onSent,
  onBack,
  onDraftSaved,
}: {
  user: AdminUser;
  customer: Customer;
  settings: StoreSettings;
  products: SalesProduct[] | null;
  draft?: OrderDraft;
  onSent: (order: Order) => void;
  onBack: () => void;
  onDraftSaved: (draft: OrderDraft) => void;
}) {
  const enabledMethods = PAYMENT_METHOD_ORDER.filter((m) => settings.enabledPaymentMethods.includes(m));
  const canChangePlan = userCan(user, "pedidos.alterar_plano");
  const maxDiscount = user.maxDiscountPercent ?? (user.role === "platformAdmin" ? 100 : 0);
  const planLocked = !!customer.preferredPaymentMethod && !canChangePlan;

  const [tab, setTab] = useState<PedidoTab>(draft?.data.items.length ? "itens" : "produtos");
  const [draftId, setDraftId] = useState<string | undefined>(draft?.id);
  const [lines, setLines] = useState<SalesOrderLine[]>(draft?.data.items ?? []);
  const [addressId, setAddressId] = useState<string | undefined>(draft?.data.addressId ?? defaultAddressId(customer));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(
    draft?.data.paymentMethod ?? customer.preferredPaymentMethod ?? enabledMethods[0],
  );
  const [installments, setInstallments] = useState<number>(draft?.data.installments ?? 1);
  const [note, setNote] = useState(draft?.data.note ?? "");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SalesProduct | null>(null);
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const productsById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const qtyInOrder = useMemo(() => new Map(lines.map((l) => [l.productId, l.quantity])), [lines]);
  const totals = salesOrderTotals(lines, productsById, customer, settings);
  const alerts =
    products === null
      ? []
      : salesOrderAlerts({
          customer,
          addressId,
          paymentMethod,
          enabledPaymentMethods: settings.enabledPaymentMethods,
          canChangePlan,
          lines,
          productsById,
          maxDiscountPercent: maxDiscount,
          subtotal: totals.subtotal,
          minOrderValue: settings.minOrderValue,
        });
  const errorCount = alerts.filter((a) => a.level === "error").length;

  const filteredProducts = useMemo(() => {
    const list = products ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.customerReferenceCode ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);
  const promoProducts = (products ?? []).filter((p) => p.promoPrice != null && p.promoPrice < p.listPrice);

  function upsertLine(line: SalesOrderLine) {
    setLines((current) => {
      const exists = current.some((l) => l.productId === line.productId);
      return exists ? current.map((l) => (l.productId === line.productId ? line : l)) : [...current, line];
    });
    setMessage(null);
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((l) => l.productId !== productId));
  }

  function draftData() {
    return { addressId, paymentMethod, installments: paymentMethod === "credit" ? installments : undefined, note: note.trim() || undefined, items: lines };
  }

  async function saveDraft() {
    setBusy("draft");
    setMessage(null);
    try {
      const id = draftId ?? newDraftId();
      const saved = await apiClient.saveOrderDraft(id, { customerId: customer.id, data: draftData() });
      if (!saved) throw new Error("UNAUTHENTICATED");
      setDraftId(saved.id);
      onDraftSaved(saved);
      setMessage({ tone: "ok", text: "Rascunho salvo. Dá para continuar depois, de qualquer aparelho." });
    } catch {
      setMessage({ tone: "error", text: "Não deu para salvar o rascunho. Tente de novo." });
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (errorCount > 0 || !addressId || !paymentMethod) {
      setTab("alertas");
      return;
    }
    setBusy("send");
    setMessage(null);
    try {
      const order = await apiClient.createAdminOrder({
        customerId: customer.id,
        addressId,
        paymentMethod,
        installments: paymentMethod === "credit" ? installments : undefined,
        note: note.trim() || undefined,
        items: lines,
        draftId,
      });
      if (!order) throw new Error("UNAUTHENTICATED");
      onSent(order);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setMessage({ tone: "error", text: SERVER_ERRORS[code] ?? (code === "UNAUTHENTICATED" ? "Sua sessão expirou. Entre de novo." : "Não deu para enviar o pedido. Tente de novo.") });
    } finally {
      setBusy(null);
    }
  }

  const address = customer.addresses.find((a) => a.id === addressId);

  return (
    <div>
      <button type="button" onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 mb-3">
        ‹ Voltar para a ficha
      </button>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div className="min-w-0">
          {customer.code && <p className="text-xs font-mono text-slate-500">Cliente {customerNumber(customer.code)}</p>}
          <h2 className="text-lg font-semibold text-slate-900 truncate">{customer.name}</h2>
        </div>
        {draftId && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0">Rascunho</span>}
      </div>

      <Tabs
        tabs={[
          { id: "cabecalho", label: "Cabeçalho" },
          { id: "produtos", label: "Produtos" },
          { id: "promocoes", label: "Promoções", badge: promoProducts.length, badgeTone: "neutral" },
          { id: "itens", label: "Itens", badge: lines.length, badgeTone: "neutral" },
          { id: "totais", label: "Totais" },
          { id: "alertas", label: "Alertas", badge: alerts.length, badgeTone: errorCount ? "error" : "neutral" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "cabecalho" && (
        <>
          <Card title="Plano de pagamento">
            <select
              value={paymentMethod ?? ""}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              disabled={planLocked}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            >
              {!paymentMethod && <option value="">Escolha…</option>}
              {(planLocked ? [customer.preferredPaymentMethod!] : enabledMethods).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                  {m === customer.preferredPaymentMethod ? " (cadastro do cliente)" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              {planLocked
                ? `Vem do cadastro do cliente (${planLabel(customer.preferredPaymentMethod)}). Para trocar é preciso a permissão "Trocar o plano de pagamento do pedido".`
                : customer.preferredPaymentMethod
                  ? `Cadastro do cliente: ${planLabel(customer.preferredPaymentMethod)}.`
                  : "Cliente sem plano no cadastro: escolha a forma de pagamento."}
            </p>
            {paymentMethod === "credit" && (
              <label className="block mt-3 text-sm">
                <span className="text-slate-600">Parcelas</span>
                <select
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                  className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                >
                  {Array.from({ length: Math.max(1, settings.maxInstallments) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x de {money(totals.total / n)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </Card>

          <Card title="Endereço de entrega">
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-red-700">Cliente sem endereço. Cadastre em Clientes.</p>
            ) : (
              <div className="space-y-2">
                {customer.addresses.map((a) => (
                  <label key={a.id} className={`flex gap-3 p-3 border rounded-md cursor-pointer ${a.id === addressId ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                    <input type="radio" name="address" checked={a.id === addressId} onChange={() => setAddressId(a.id)} className="mt-1" />
                    <span className="text-sm">
                      <span className="block text-slate-900">
                        {a.street}, {a.number}
                        {a.complement ? ` — ${a.complement}` : ""}
                      </span>
                      <span className="block text-slate-500">
                        {a.neighborhood} · {a.city}/{a.state}
                        {a.isDefault ? " · padrão" : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </Card>

          <Card title="Observação">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Ex.: entregar pela manhã, falar com o gerente…"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </Card>
        </>
      )}

      {(tab === "produtos" || tab === "promocoes") && (
        <>
          {tab === "produtos" && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, código, marca ou código de referência"
              className="w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm mb-3"
            />
          )}
          {products === null ? (
            <p className="text-sm text-slate-500">Carregando produtos…</p>
          ) : (tab === "produtos" ? filteredProducts : promoProducts).length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">{tab === "produtos" ? "Nenhum produto encontrado." : "Nenhuma promoção ativa agora."}</p>
            </Card>
          ) : (
            <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
              {(tab === "produtos" ? filteredProducts : promoProducts).map((p) => {
                const base = salesBasePrice(p);
                const inOrder = qtyInOrder.get(p.id);
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => setEditing(p)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-900 truncate">{p.name}</span>
                        <span className="block text-xs text-slate-500 truncate">
                          Cód. {p.sku}
                          {p.brand ? ` · ${p.brand}` : ""} · Estoque{" "}
                          <span className={p.stock <= 0 ? "text-red-600" : ""}>{p.stock}</span>
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        {base < p.listPrice && <span className="block text-xs text-slate-400 line-through">{money(p.listPrice)}</span>}
                        <span className="block text-sm font-semibold text-slate-900">
                          {money(base)}
                          <span className="text-xs font-normal text-slate-500">/{UNIT_LABEL[p.unitType] ?? p.unitType}</span>
                        </span>
                      </span>
                      {inOrder != null && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-600 text-white shrink-0">{inOrder}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === "itens" &&
        (lines.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              Nenhum item ainda.{" "}
              <button type="button" onClick={() => setTab("produtos")} className="text-brand-700 font-medium">
                Escolher produtos
              </button>
            </p>
          </Card>
        ) : (
          <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {lines.map((line) => {
              const p = productsById.get(line.productId);
              if (!p) {
                return (
                  <li key={line.productId} className="px-4 py-3 flex items-center gap-3 text-sm">
                    <span className="flex-1 text-red-700">Produto indisponível</span>
                    <button type="button" onClick={() => removeLine(line.productId)} className="text-slate-500 hover:text-red-600">
                      Remover
                    </button>
                  </li>
                );
              }
              const unit = netUnitPrice(salesBasePrice(p), line.discountPercent);
              return (
                <li key={line.productId}>
                  <button type="button" onClick={() => setEditing(p)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{p.name}</span>
                      <span className="block text-xs text-slate-500">
                        {line.quantity} {UNIT_LABEL[p.unitType] ?? p.unitType} × {money(unit)}
                        {line.discountPercent > 0 && <span className="text-green-700"> · −{line.discountPercent}%</span>}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-slate-900 shrink-0">{money(salesLineSubtotal(p, line.quantity, line.discountPercent))}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === "totais" && (
        <>
          <Card>
            <dl className="space-y-1.5 text-sm">
              <Row label={`Itens (${lines.length})`} value={money(totals.grossSubtotal)} />
              {totals.sellerDiscount > 0 && <Row label="Desconto do vendedor" value={`− ${money(totals.sellerDiscount)}`} tone="green" />}
              <Row label="Subtotal" value={money(totals.subtotal)} />
              <Row label="Frete" value={totals.shipping === 0 ? "Grátis" : money(totals.shipping)} />
              <div className="border-t border-slate-200 pt-2 mt-2">
                <Row label="Total" value={money(totals.total)} strong />
              </div>
            </dl>
          </Card>
          <Card title="Resumo">
            <dl className="space-y-1.5 text-sm">
              <Row label="Plano" value={paymentMethod ? `${PAYMENT_METHOD_LABEL[paymentMethod]}${paymentMethod === "credit" ? ` em ${installments}x` : ""}` : "—"} />
              <Row label="Entrega" value={address ? `${address.street}, ${address.number} · ${address.neighborhood}` : "—"} />
              {note.trim() && <Row label="Observação" value={note.trim()} />}
              <Row label="Seu limite de desconto" value={`${maxDiscount}% por item`} />
            </dl>
          </Card>
          <p className="text-xs text-slate-500">Valores de itens com peso variável são estimados; o total final pode mudar na separação.</p>
        </>
      )}

      {tab === "alertas" &&
        (alerts.length === 0 ? (
          <Card>
            <p className="text-sm text-green-700">Tudo certo: o pedido pode ser enviado.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li
                key={`${a.code}-${a.productId ?? i}`}
                className={`rounded-lg p-3 text-sm border ${
                  a.level === "error"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : a.level === "warning"
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-sky-50 border-sky-200 text-sky-800"
                }`}
              >
                <span className="font-semibold">{a.level === "error" ? "Erro" : a.level === "warning" ? "Atenção" : "Informação"}: </span>
                {a.message}
              </li>
            ))}
          </ul>
        ))}

      {message && (
        <p className={`mt-3 text-sm rounded-md p-2.5 ${message.tone === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`} role="status">
          {message.text}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 md:-mx-8 mt-4 bg-white border-t border-slate-200 px-4 md:px-8 py-3 z-20">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">
              {lines.length} {lines.length === 1 ? "item" : "itens"}
              {errorCount > 0 && <span className="text-red-600"> · {errorCount} {errorCount === 1 ? "pendência" : "pendências"}</span>}
            </p>
            <p className="text-lg font-semibold text-slate-900 whitespace-nowrap">{money(totals.total)}</p>
          </div>
          <button
            type="button"
            onClick={saveDraft}
            disabled={busy !== null || lines.length === 0}
            className="shrink-0 border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-sm font-medium px-3 py-2.5 rounded-md"
          >
            {busy === "draft" ? "Salvando…" : <>Salvar<span className="hidden sm:inline"> rascunho</span></>}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy !== null || products === null}
            className="shrink-0 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-md"
          >
            {busy === "send" ? "Enviando…" : "Enviar pedido"}
          </button>
        </div>
      </div>

      {editing && (
        <ItemSheet
          product={editing}
          line={lines.find((l) => l.productId === editing.id)}
          maxDiscount={maxDiscount}
          onClose={() => setEditing(null)}
          onSave={(line) => {
            upsertLine(line);
            setEditing(null);
          }}
          onRemove={() => {
            removeLine(editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "green" }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? "font-semibold text-slate-900" : "text-slate-600"}>{label}</dt>
      <dd className={`text-right ${strong ? "font-semibold text-slate-900 text-base" : tone === "green" ? "text-green-700" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}

// Tela do item (abre ao tocar no produto): quantidade, desconto dentro do limite e prévia do valor.
function ItemSheet({
  product,
  line,
  maxDiscount,
  onClose,
  onSave,
  onRemove,
}: {
  product: SalesProduct;
  line?: SalesOrderLine;
  maxDiscount: number;
  onClose: () => void;
  onSave: (line: SalesOrderLine) => void;
  onRemove: () => void;
}) {
  const [quantity, setQuantity] = useState(String(line?.quantity ?? 1));
  const [discount, setDiscount] = useState(String(line?.discountPercent ?? 0));
  const qty = Number(quantity.replace(",", "."));
  const pct = Number(discount.replace(",", ".")) || 0;
  const base = salesBasePrice(product);
  const validQty = Number.isFinite(qty) && qty > 0;
  const overLimit = pct > maxDiscount || pct < 0;
  const step = (delta: number) => setQuantity(String(Math.max(1, (validQty ? qty : 0) + delta)));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={product.name}
      >
        <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
        <p className="text-xs text-slate-500 mb-4">
          Cód. {product.sku} · Estoque {product.stock} · {money(base)}/{UNIT_LABEL[product.unitType] ?? product.unitType}
          {base < product.listPrice && <span className="text-green-700"> (promoção, de {money(product.listPrice)})</span>}
        </p>

        <label className="block text-sm text-slate-600 mb-1">Quantidade</label>
        <div className="flex items-center gap-2 mb-4">
          <button type="button" onClick={() => step(-1)} className="w-11 h-11 shrink-0 border border-slate-300 rounded-md text-lg" aria-label="Diminuir">
            −
          </button>
          <input
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="flex-1 min-w-0 w-full border border-slate-300 rounded-md px-3 py-2.5 text-center text-base"
          />
          <button type="button" onClick={() => step(1)} className="w-11 h-11 shrink-0 border border-slate-300 rounded-md text-lg" aria-label="Aumentar">
            +
          </button>
        </div>

        <label className="block text-sm text-slate-600 mb-1">Desconto (%)</label>
        <input
          inputMode="decimal"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          disabled={maxDiscount <= 0}
          className={`w-full border rounded-md px-3 py-2.5 text-base disabled:bg-slate-50 ${overLimit ? "border-red-500" : "border-slate-300"}`}
        />
        <p className={`text-xs mt-1 ${overLimit ? "text-red-600" : "text-slate-500"}`}>
          {maxDiscount <= 0 ? "Seu perfil não permite dar desconto." : `Seu limite: até ${maxDiscount}% por item.`}
        </p>

        {validQty && (
          <div className="mt-4 bg-slate-50 rounded-md p-3 text-sm flex justify-between">
            <span className="text-slate-600">
              {money(netUnitPrice(base, pct))} × {qty}
              {product.isVariableWeight ? ` × ~${product.avgWeight ?? 1}kg` : ""}
            </span>
            <span className="font-semibold text-slate-900">{money(salesLineSubtotal(product, qty, pct))}</span>
          </div>
        )}
        {validQty && qty > product.stock && <p className="text-xs text-amber-700 mt-2">Quantidade maior que o estoque ({product.stock}).</p>}

        <div className="flex gap-2 mt-5">
          {line && (
            <button type="button" onClick={onRemove} className="text-sm text-red-600 px-3 py-2.5 mr-auto">
              Remover
            </button>
          )}
          <button type="button" onClick={onClose} className="text-sm text-slate-600 px-3 py-2.5 ml-auto">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!validQty || overLimit}
            onClick={() => onSave({ productId: product.id, quantity: qty, discountPercent: Math.round(pct * 100) / 100 })}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-md"
          >
            {line ? "Atualizar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
