"use client";

import { use, useEffect, useState } from "react";
import { apiClient, ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from "@ecommerce/api-client";
import type { Order } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAdminAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    apiClient.getAdminOrder(id).then(setOrder);
  }, [id]);

  if (!order) {
    return (
      <AdminShell>
        <p className="text-slate-500">Carregando...</p>
      </AdminShell>
    );
  }

  const visibleItems = user?.role === "vendorAdmin" ? order.items.filter((i) => i.vendorId === user.vendorId) : order.items;
  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  const nextStatus = ORDER_STATUS_FLOW[currentIndex + 1];

  async function advance() {
    if (!nextStatus) return;
    setAdvancing(true);
    setOrder(await apiClient.advanceOrderStatus(id, nextStatus));
    setAdvancing(false);
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{order.orderNumber}</h1>
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
        <h2 className="font-semibold text-slate-900 mb-3">Itens {user?.role === "vendorAdmin" && "(seus itens neste pedido)"}</h2>
        <div className="divide-y divide-slate-100 text-sm">
          {visibleItems.map((item) => (
            <div key={item.productId} className="py-2.5 flex justify-between">
              <div>
                <p className="text-slate-900">{item.name}</p>
                <p className="text-slate-500">
                  {item.quantity} × R$ {item.unitPrice.toFixed(2).replace(".", ",")}/{item.unitType}
                </p>
              </div>
              <p className="font-medium text-slate-900">R$ {(item.finalSubtotal ?? item.estimatedSubtotal).toFixed(2).replace(".", ",")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="font-semibold text-slate-900 mb-1">Entrega</h3>
          <p className="text-slate-600">
            {order.shippingAddress.street}, {order.shippingAddress.number} — {order.shippingAddress.neighborhood},{" "}
            {order.shippingAddress.city}/{order.shippingAddress.state}
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
