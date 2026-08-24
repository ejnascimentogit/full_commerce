"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from "@ecommerce/api-client";
import type { Customer, Order, OrderStatus } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function PedidosPage() {
  const { user } = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, Customer>>({});
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");

  useEffect(() => {
    if (!user) return;
    const vendorId = user.role === "vendorAdmin" ? user.vendorId : undefined;
    apiClient.getAdminOrders({ vendorId, status: statusFilter || undefined }).then(setOrders);
  }, [user, statusFilter]);

  useEffect(() => {
    if (!user) return;
    apiClient.getAdminCustomers().then((customers) => {
      setCustomersById(Object.fromEntries(customers.map((c) => [c.id, c])));
    });
  }, [user]);

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pedidos</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {ORDER_STATUS_FLOW.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Pedido</th>
              <th className="text-left px-4 py-2.5">Código</th>
              <th className="text-left px-4 py-2.5">Cliente</th>
              <th className="text-left px-4 py-2.5">Data</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Total</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => {
              const customer = customersById[order.customerId];
              return (
              <tr key={order.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{order.orderNumber}</td>
                <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{customer?.code ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-700">{customer?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">{ORDER_STATUS_LABEL[order.status]}</span>
                </td>
                <td className="px-4 py-2.5 text-right">R$ {order.total.toFixed(2).replace(".", ",")}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/pedidos/${order.id}`} className="text-brand-600 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {orders.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">Nenhum pedido encontrado.</p>}
      </div>
    </AdminShell>
  );
}
