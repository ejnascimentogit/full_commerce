"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ORDER_STATUS_FLOW, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@ecommerce/api-client";
import type { Order, StoreSettings } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { downloadOrderPdf } from "@/lib/order-pdf";

export default function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAdminAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [savingItems, setSavingItems] = useState(false);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [confirmingBelowMinimum, setConfirmingBelowMinimum] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    apiClient.getAdminOrder(id).then(setOrder);
  }, [id]);

  useEffect(() => {
    apiClient.getStoreSettings().then(setSettings);
  }, []);

  if (!order) {
    return (
      <AdminShell>
        <p className="text-slate-500">Carregando...</p>
      </AdminShell>
    );
  }

  const visibleItems = user?.role === "vendorAdmin" ? order.items.filter((i) => i.vendorId === user.vendorId) : order.items;
  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  // CANCELLED/REFUNDED não fazem parte do fluxo linear (indexOf retorna -1) —
  // sem essa guarda, um pedido cancelado mostraria "Avançar para: Pendente".
  const nextStatus = currentIndex === -1 ? undefined : ORDER_STATUS_FLOW[currentIndex + 1];
  const isTerminal = order.status === "CANCELLED" || order.status === "REFUNDED";
  // Depois que sai para entrega, a mercadoria já deixou o estoque e a nota
  // fiscal já foi emitida — trava o ajuste de itens, a não ser que o admin
  // tenha ligado o parâmetro em Configurações.
  const isDispatched = order.status === "OUT_FOR_DELIVERY" || order.status === "DELIVERED";
  const itemsLocked = isTerminal || (isDispatched && !settings?.allowAdjustmentsAfterDispatch);

  async function advance() {
    if (!nextStatus) return;
    setAdvancing(true);
    setOrder(await apiClient.advanceOrderStatus(id, nextStatus));
    setAdvancing(false);
  }

  function startEditingItems() {
    const initial: Record<string, string> = {};
    for (const item of visibleItems) {
      const currentTotal = item.finalSubtotal ?? item.estimatedSubtotal;
      initial[item.productId] = (currentTotal / item.unitPrice).toFixed(item.unitType === "kg" ? 3 : 0);
    }
    setQuantities(initial);
    setEditingItems(true);
  }

  async function saveItemAdjustments() {
    setSavingItems(true);
    const adjustments = visibleItems.map((item) => ({
      productId: item.productId,
      finalQuantity: Number(quantities[item.productId]) || 0,
    }));
    const updated = await apiClient.updateOrderItems(id, adjustments);
    setOrder(updated);
    setSavingItems(false);
    setEditingItems(false);
    setConfirmingBelowMinimum(false);
  }

  // Ajuste na separação pode derrubar o total abaixo do pedido mínimo da loja
  // (ex: faltou peso do produto). Não deixa salvar direto nesse caso — o
  // admin precisa falar com o cliente antes: cancelar o pedido ou seguir
  // assim mesmo (ex: cliente aceitou, ou vai completar com outro item).
  const projectedSubtotal = order.items.reduce((sum, item) => {
    const typed = quantities[item.productId];
    if (typed !== undefined) return sum + item.unitPrice * (Number(typed) || 0);
    return sum + (item.finalSubtotal ?? item.estimatedSubtotal);
  }, 0);
  const belowMinimum = editingItems && !!settings?.minOrderValue && projectedSubtotal < settings.minOrderValue;

  function requestSaveItemAdjustments() {
    if (belowMinimum) {
      setConfirmingBelowMinimum(true);
      return;
    }
    saveItemAdjustments();
  }

  async function cancelOrder() {
    setCancelling(true);
    const updated = await apiClient.advanceOrderStatus(id, "CANCELLED");
    setOrder(updated);
    setCancelling(false);
    setConfirmingBelowMinimum(false);
    setEditingItems(false);
  }

  return (
    <AdminShell>
      <Link href="/pedidos" className="text-sm text-brand-600 hover:underline">
        ← Voltar para pedidos
      </Link>
      <div className="flex items-start justify-between mb-1 mt-2">
        <h1 className="text-2xl font-bold text-slate-900">{order.orderNumber}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/pedidos/${id}/imprimir`}
            target="_blank"
            className="text-sm font-medium text-slate-600 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50"
          >
            🖨️ Imprimir separação
          </Link>
          <button
            type="button"
            onClick={() => downloadOrderPdf(order, visibleItems)}
            className="text-sm font-medium text-slate-600 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50"
          >
            📄 Gerar PDF
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-6">Feito em {new Date(order.createdAt).toLocaleDateString("pt-BR")}</p>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Status atual</p>
          <p className="font-semibold text-slate-900">{ORDER_STATUS_LABEL[order.status]}</p>
        </div>
        {user?.role === "platformAdmin" && nextStatus && (
          <button
            type="button"
            onClick={advance}
            disabled={advancing}
            className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {advancing ? "Avançando..." : `Avançar para: ${ORDER_STATUS_LABEL[nextStatus]}`}
          </button>
        )}
        {user?.role === "vendorAdmin" && (
          <p className="text-xs text-slate-400 max-w-xs text-right">
            Avanço de status de entrega é feito pela plataforma, não pelo fornecedor.
          </p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Itens {user?.role === "vendorAdmin" && "(seus itens neste pedido)"}</h2>
          {itemsLocked ? null : !editingItems ? (
            <button
              type="button"
              onClick={startEditingItems}
              className="text-sm font-medium text-brand-600 border border-brand-200 rounded-md px-3 py-1.5 hover:bg-brand-50"
            >
              ✏️ Ajustar quantidades separadas
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setEditingItems(false)} className="text-sm text-slate-500 hover:text-slate-700">
                Cancelar
              </button>
              <button
                type="button"
                onClick={requestSaveItemAdjustments}
                disabled={savingItems}
                className="bg-brand-600 text-white font-semibold rounded-md px-3 py-1.5 text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {savingItems ? "Salvando..." : "Salvar ajuste"}
              </button>
            </div>
          )}
        </div>
        {isDispatched && itemsLocked && (
          <p className="text-xs text-slate-500 mb-3 bg-slate-50 rounded-md px-3 py-2">
            🔒 Pedido {order.status === "DELIVERED" ? "entregue" : "saiu para entrega"} — mercadoria já baixada do
            estoque e nota fiscal emitida, quantidade não pode mais ser ajustada. Para liberar mesmo assim, ligue o
            parâmetro em Configurações → Pedidos e frete.
          </p>
        )}
        {editingItems && !belowMinimum && (
          <p className="text-xs text-slate-500 mb-3 bg-amber-50 rounded-md px-3 py-2">
            Informe a quantidade realmente separada de cada item. O cliente verá o pedido marcado como ajustado, com o valor a mais ou a menos.
          </p>
        )}
        {belowMinimum && settings?.minOrderValue && (
          <p className="text-xs text-red-700 mb-3 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            ⚠️ Com esse ajuste o pedido fica em R$ {projectedSubtotal.toFixed(2).replace(".", ",")}, abaixo do mínimo de R${" "}
            {settings.minOrderValue.toFixed(2).replace(".", ",")}. Fale com o cliente antes de salvar — ele vai precisar decidir entre
            cancelar o pedido ou completar com outro item.
          </p>
        )}
        {confirmingBelowMinimum && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm font-semibold text-red-800 mb-1">Pedido abaixo do valor mínimo</p>
            <p className="text-sm text-red-700 mb-3">
              Já conversou com o cliente? Escolha o que fazer — não é possível deixar o pedido salvo abaixo do mínimo sem uma decisão.
            </p>
            <div className="flex flex-wrap gap-2">
              {user?.role === "platformAdmin" ? (
                <button
                  type="button"
                  onClick={cancelOrder}
                  disabled={cancelling || savingItems}
                  className="bg-red-600 text-white font-semibold rounded-md px-3 py-1.5 text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelling ? "Cancelando..." : "Cancelar pedido"}
                </button>
              ) : (
                <p className="text-xs text-red-600 self-center">Cancelar o pedido é uma ação da plataforma, não do fornecedor.</p>
              )}
              <button
                type="button"
                onClick={saveItemAdjustments}
                disabled={cancelling || savingItems}
                className="bg-white border border-red-300 text-red-700 font-semibold rounded-md px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50"
              >
                {savingItems ? "Salvando..." : "Cliente aceitou — confirmar assim mesmo"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingBelowMinimum(false)}
                disabled={cancelling || savingItems}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5"
              >
                Voltar e ajustar
              </button>
            </div>
          </div>
        )}
        <div className="divide-y divide-slate-100 text-sm">
          {visibleItems.map((item, i) => {
            const currentTotal = item.finalSubtotal ?? item.estimatedSubtotal;
            const delta = item.finalSubtotal != null ? Math.round((item.finalSubtotal - item.estimatedSubtotal) * 100) / 100 : 0;
            return (
              <div key={item.productId} className="py-2.5 flex justify-between items-center gap-3">
                <span className="w-6 shrink-0 text-slate-400 font-mono text-xs">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-slate-900">{item.name}</p>
                  {editingItems ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        step={item.unitType === "kg" ? "0.001" : "1"}
                        min="0"
                        value={quantities[item.productId] ?? ""}
                        onChange={(e) => setQuantities({ ...quantities, [item.productId]: e.target.value })}
                        className="w-28 border border-slate-300 rounded-md px-2 py-1 text-sm"
                      />
                      <span className="text-slate-500 text-xs">
                        {item.unitType} — pedido: {(item.estimatedSubtotal / item.unitPrice).toFixed(item.unitType === "kg" ? 3 : 0)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-slate-500">
                      {(currentTotal / item.unitPrice).toFixed(item.unitType === "kg" ? 3 : 0)} {item.unitType} × R${" "}
                      {item.unitPrice.toFixed(2).replace(".", ",")}/{item.unitType}
                      {delta !== 0 && (
                        <span className={`ml-2 font-medium ${delta > 0 ? "text-green-600" : "text-amber-600"}`}>
                          {delta > 0 ? "▲" : "▼"} ajustado {delta > 0 ? "para mais" : "para menos"}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                {!editingItems && <p className="font-medium text-slate-900">R$ {currentTotal.toFixed(2).replace(".", ",")}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {!!order.itemAdjustments?.length && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-semibold text-slate-900 mb-3">Histórico de ajustes</h2>
          <div className="divide-y divide-slate-100 text-sm">
            {order.itemAdjustments.map((adj, i) => (
              <div key={i} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-900">{adj.productName}</p>
                  <p className="text-xs text-slate-500">
                    {adj.adminName} — {new Date(adj.changedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <p className="text-slate-600">
                  R$ {adj.previousSubtotal.toFixed(2).replace(".", ",")} →{" "}
                  <span className={`font-semibold ${adj.newSubtotal > adj.previousSubtotal ? "text-green-600" : "text-amber-600"}`}>
                    R$ {adj.newSubtotal.toFixed(2).replace(".", ",")}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-5 grid sm:grid-cols-3 gap-4 text-sm">
        <div>
          <h3 className="font-semibold text-slate-900 mb-1">Entrega</h3>
          <p className="text-slate-600">
            {order.shippingAddress.street}, {order.shippingAddress.number} — {order.shippingAddress.neighborhood},{" "}
            {order.shippingAddress.city}/{order.shippingAddress.state}
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 mb-1">Condição de pagamento</h3>
          <p className="text-slate-600">
            {PAYMENT_METHOD_LABEL[order.paymentMethod]}
            {order.paymentMethod === "credit" && order.installments
              ? ` — ${order.installments}x de R$ ${(order.total / order.installments).toFixed(2).replace(".", ",")}${order.installments === 1 ? " à vista" : " sem juros"}`
              : ""}
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 mb-1">Total do pedido</h3>
          <p className="text-slate-900 font-bold">R$ {order.total.toFixed(2).replace(".", ",")}</p>
        </div>
      </div>
    </AdminShell>
  );
}
