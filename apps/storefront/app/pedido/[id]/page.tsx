"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from "@ecommerce/api-client";
import type { Order, OrderStatus } from "@ecommerce/types";

const paymentMethodLabel: Record<Order["paymentMethod"], string> = {
  card: "Cartão de crédito",
  pix: "PIX",
  boleto: "Boleto",
};

export default function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    apiClient.getOrder(id).then(setOrder);
  }, [id]);

  if (!order) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Carregando pedido...</div>;
  }

  const currentStepIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  const isTerminalIssue = order.status === "CANCELLED" || order.status === "REFUNDED";

  async function advance() {
    const next = ORDER_STATUS_FLOW[currentStepIndex + 1];
    if (!next) return;
    setAdvancing(true);
    const updated = await apiClient.advanceOrderStatus(id, next);
    setOrder(updated);
    setAdvancing(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedido {order.orderNumber}</h1>
          <p className="text-sm text-slate-500">Feito em {new Date(order.createdAt).toLocaleDateString("pt-BR")}</p>
        </div>
        <Link href="/conta/pedidos" className="text-sm text-brand-600 hover:underline">
          Meus pedidos
        </Link>
      </div>

      {!isTerminalIssue && (
        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-semibold text-slate-900 mb-4">Acompanhamento</h2>
          <ol className="space-y-4">
            {ORDER_STATUS_FLOW.map((status, i) => {
              const done = i <= currentStepIndex;
              return (
                <li key={status} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-400"}`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className={done ? "text-slate-900 font-medium" : "text-slate-400"}>
                    {ORDER_STATUS_LABEL[status]}
                  </span>
                </li>
              );
            })}
          </ol>

          {currentStepIndex < ORDER_STATUS_FLOW.length - 1 && (
            <button
              type="button"
              onClick={advance}
              disabled={advancing}
              className="mt-5 text-sm text-brand-600 border border-brand-200 rounded-md px-3 py-1.5 hover:bg-brand-50 disabled:opacity-50"
            >
              {advancing ? "Avançando..." : `[Demo] Simular: ${ORDER_STATUS_LABEL[ORDER_STATUS_FLOW[currentStepIndex + 1]]}`}
            </button>
          )}
        </section>
      )}

      {isTerminalIssue && (
        <section className="bg-red-50 border border-red-200 rounded-lg p-5 mb-4 text-red-700 font-medium">
          Pedido {ORDER_STATUS_LABEL[order.status].toLowerCase()}
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
        <h2 className="font-semibold text-slate-900 mb-3">Itens do pedido</h2>
        <div className="divide-y divide-slate-100">
          {order.items.map((item) => (
            <div key={item.productId} className="py-2.5 flex justify-between items-center text-sm">
              <div>
                <p className="text-slate-900">{item.name}</p>
                <p className="text-slate-500">
                  {item.quantity} × R$ {item.unitPrice.toFixed(2).replace(".", ",")}/{item.unitType}
                </p>
              </div>
              <p className="font-medium text-slate-900">
                R$ {(item.finalSubtotal ?? item.estimatedSubtotal).toFixed(2).replace(".", ",")}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 text-sm space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>R$ {order.subtotal.toFixed(2).replace(".", ",")}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Desconto</span>
              <span>− R$ {order.discount.toFixed(2).replace(".", ",")}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Frete</span>
            <span className={order.shipping === 0 ? "text-green-600 font-medium" : ""}>
              {order.shipping === 0 ? "Grátis" : `R$ ${order.shipping.toFixed(2).replace(".", ",")}`}
            </span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 text-base">
            <span>Total</span>
            <span>R$ {order.total.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="font-semibold text-slate-900 mb-1">Entrega</h3>
          <p className="text-slate-600">
            {order.shippingAddress.street}, {order.shippingAddress.number} — {order.shippingAddress.neighborhood},{" "}
            {order.shippingAddress.city}/{order.shippingAddress.state}
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 mb-1">Pagamento</h3>
          <p className="text-slate-600">{paymentMethodLabel[order.paymentMethod]}</p>
        </div>
      </section>
    </div>
  );
}
