"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ORDER_STATUS_LABEL } from "@ecommerce/api-client";
import type { Order, Product } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

export default function DashboardPage() {
  const { user } = useAdminAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!user) return;
    const vendorId = user.role === "vendorAdmin" ? user.vendorId : undefined;
    apiClient.getProducts({ vendorId, pageSize: 200 }).then((r) => setProducts(r.items));
    apiClient.getAdminOrders({ vendorId }).then(setOrders);
  }, [user]);

  const pendingDelivery = orders.filter((o) => o.status === "PREPARING" || o.status === "OUT_FOR_DELIVERY").length;
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Stat label="Produtos" value={products.length} />
        <Stat label="Pedidos" value={orders.length} />
        <Stat label="Aguardando entrega" value={pendingDelivery} />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <p className="text-sm text-slate-500">Total em pedidos</p>
        <p className="text-2xl font-bold text-slate-900">R$ {revenue.toFixed(2).replace(".", ",")}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Pedidos recentes</h2>
        <div className="divide-y divide-slate-100">
          {orders.slice(0, 5).map((order) => (
            <Link key={order.id} href={`/pedidos/${order.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-brand-600">
              <span>{order.orderNumber}</span>
              <span className="text-slate-500">{ORDER_STATUS_LABEL[order.status]}</span>
            </Link>
          ))}
          {orders.length === 0 && <p className="text-sm text-slate-500 py-2">Nenhum pedido ainda.</p>}
        </div>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
