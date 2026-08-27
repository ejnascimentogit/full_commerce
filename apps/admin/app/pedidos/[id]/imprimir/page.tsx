"use client";

import { use, useEffect, useState } from "react";
import { apiClient, PAYMENT_METHOD_LABEL } from "@ecommerce/api-client";
import type { Order } from "@ecommerce/types";
import { useAdminAuth } from "@/lib/admin-auth-context";

// Página isolada (sem AdminShell/menu) — só o essencial pra quem vai separar
// a mercadoria conferir e marcar item por item no papel.
export default function ImprimirPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAdminAuth();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    apiClient.getAdminOrder(id).then(setOrder);
  }, [id]);

  if (!user || !order) {
    return <p className="p-8 text-slate-500">Carregando...</p>;
  }

  const visibleItems = user.role === "vendorAdmin" ? order.items.filter((i) => i.vendorId === user.vendorId) : order.items;

  return (
    <div className="max-w-2xl mx-auto p-8 print:p-0">
      <div className="flex justify-end mb-6 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700"
        >
          🖨️ Imprimir
        </button>
      </div>

      <h1 className="text-xl font-bold text-slate-900">Separação — {order.orderNumber}</h1>
      <p className="text-sm text-slate-600 mb-6">Feito em {new Date(order.createdAt).toLocaleDateString("pt-BR")}</p>

      <table className="w-full text-sm border-collapse mb-8">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left">
            <th className="py-2 w-8">✓</th>
            <th className="py-2 w-8">#</th>
            <th className="py-2">Produto</th>
            <th className="py-2 text-right">Qtd.</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item, i) => (
            <tr key={item.productId} className="border-b border-slate-300">
              <td className="py-3">
                <span className="inline-block w-4 h-4 border border-slate-900" />
              </td>
              <td className="py-3 text-slate-500">{i + 1}</td>
              <td className="py-3">
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">SKU: {item.sku}</p>
              </td>
              <td className="py-3 text-right font-bold text-slate-900 text-base">
                {(item.estimatedSubtotal / item.unitPrice).toFixed(item.unitType === "kg" ? 3 : 0)} {item.unitType}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-sm space-y-1">
        <p>
          <span className="font-semibold">Entrega:</span> {order.shippingAddress.street}, {order.shippingAddress.number} —{" "}
          {order.shippingAddress.neighborhood}, {order.shippingAddress.city}/{order.shippingAddress.state}
        </p>
        <p>
          <span className="font-semibold">Pagamento:</span> {PAYMENT_METHOD_LABEL[order.paymentMethod]}
        </p>
        <p className="font-bold text-base pt-1">Total: R$ {order.total.toFixed(2).replace(".", ",")}</p>
      </div>
    </div>
  );
}
