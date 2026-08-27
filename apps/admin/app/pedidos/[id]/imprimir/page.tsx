"use client";

import { use, useEffect, useState } from "react";
import { apiClient, PAYMENT_METHOD_LABEL } from "@ecommerce/api-client";
import type { Customer, DeliveryRegion, Order, Product } from "@ecommerce/types";
import { useAdminAuth } from "@/lib/admin-auth-context";

const UNIT_TYPE_LABEL: Record<string, string> = { un: "Un.", kg: "Kg", cx: "Cx." };

// Página isolada (sem AdminShell/menu) — só o essencial pra quem vai separar
// a mercadoria conferir e marcar item por item no papel.
export default function ImprimirPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAdminAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    apiClient.getAdminOrder(id).then(setOrder);
    apiClient.getRegions({ includeInactive: true }).then(setRegions);
    apiClient.getAdminProducts().then(setProducts);
  }, [id]);

  useEffect(() => {
    if (!order) return;
    apiClient.getAdminCustomers().then((customers) => {
      setCustomer(customers.find((c) => c.id === order.customerId) ?? null);
    });
  }, [order]);

  if (!user || !order) {
    return <p className="p-8 text-slate-500">Carregando...</p>;
  }

  const visibleItems = user.role === "vendorAdmin" ? order.items.filter((i) => i.vendorId === user.vendorId) : order.items;
  const routeName = regions.find((r) => r.id === order.regionId)?.name;
  const productById = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="max-w-4xl mx-auto p-8 print:p-0">
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
      <p className="text-sm text-slate-600">Feito em {new Date(order.createdAt).toLocaleDateString("pt-BR")}</p>
      <p className="text-sm text-slate-600 mb-6">
        <span className="font-semibold">Cliente:</span> {customer?.name ?? "—"}
      </p>

      <table className="w-full text-sm border-collapse mb-8 table-fixed">
        <colgroup>
          <col className="w-[4%]" />
          <col className="w-[4%]" />
          <col className="w-[13%]" />
          <col className="w-[33%]" />
          <col className="w-[6%]" />
          <col className="w-[10%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-slate-900 text-left">
            <th className="py-2 pr-2">✓</th>
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-3">Código</th>
            <th className="py-2 pr-3">Produto</th>
            <th className="py-2 pr-4 text-left">Un.</th>
            <th className="py-2 pr-4 text-right">Volumes</th>
            <th className="py-2 pr-6 text-right">Qtd.</th>
            <th className="py-2 pl-4 text-right">Qtd. separada</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item, i) => (
            <tr key={item.productId} className="border-b border-slate-300">
              <td className="py-3 pr-2">
                <span className="inline-block w-4 h-4 border border-slate-900" />
              </td>
              <td className="py-3 pr-2 text-slate-500">{i + 1}</td>
              <td className="py-3 pr-3 text-slate-500 font-mono text-xs">
                {productById.get(item.productId)?.customerReferenceCode || item.sku}
              </td>
              <td className="py-3 pr-3">
                <p className="font-medium text-slate-900">{item.name}</p>
              </td>
              <td className="py-3 pr-4 text-slate-500">{UNIT_TYPE_LABEL[item.unitType] ?? item.unitType}</td>
              <td className="py-3 pr-4 text-right text-slate-700">{item.quantity}</td>
              <td className="py-3 pr-6 text-right font-bold text-slate-900 text-base">
                {(item.estimatedSubtotal / item.unitPrice).toFixed(item.unitType === "kg" ? 3 : 0)} {item.unitType}
              </td>
              <td className="py-3 pl-4 text-right">
                <span className="inline-block w-16 border-b border-slate-400">&nbsp;</span>
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
          <span className="font-semibold">Rota:</span> {routeName ?? "Fora de zona"}
        </p>
        <p>
          <span className="font-semibold">Pagamento:</span> {PAYMENT_METHOD_LABEL[order.paymentMethod]}
        </p>
        <p className="font-bold text-base pt-1">Total: R$ {order.total.toFixed(2).replace(".", ",")}</p>
      </div>
    </div>
  );
}
