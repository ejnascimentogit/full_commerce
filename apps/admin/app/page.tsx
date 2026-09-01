"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ORDER_STATUS_LABEL } from "@ecommerce/api-client";
import type { Activity, Order, OrderStatus, Product } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { isOverdue } from "@/app/atividades/page";

export default function DashboardPage() {
  const { user } = useAdminAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const canAccessAtividades = user?.role === "platformAdmin" || (user?.role === "staff" && (user.permissions ?? []).includes("atividades"));

  useEffect(() => {
    if (!user) return;
    const vendorId = user.role === "vendorAdmin" ? user.vendorId : undefined;
    apiClient.getProducts({ vendorId, pageSize: 200 }).then((r) => setProducts(r.items));
    apiClient.getAdminOrders({ vendorId }).then(setOrders);
    if (canAccessAtividades) apiClient.getActivities().then(setActivities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const overdueActivities = activities.filter(isOverdue).length;

  const pendingDelivery = orders.filter((o) => o.status === "PREPARING" || o.status === "OUT_FOR_DELIVERY").length;
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);

  // Faturamento por dia (últimos 7 dias, incluindo hoje).
  const dailyRevenue: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const dayKey = day.toISOString().slice(0, 10);
    const total = orders.filter((o) => o.createdAt.slice(0, 10) === dayKey).reduce((sum, o) => sum + o.total, 0);
    dailyRevenue.push({ label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value: total });
  }

  // Pedidos por status.
  const statusCounts = new Map<OrderStatus, number>();
  for (const o of orders) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
  const byStatus = [...statusCounts.entries()]
    .map(([status, count]) => ({ label: ORDER_STATUS_LABEL[status], value: count }))
    .sort((a, b) => b.value - a.value);

  // Produtos mais vendidos (por quantidade, somando todos os pedidos).
  const productQty = new Map<string, number>();
  for (const o of orders) {
    for (const item of o.items) productQty.set(item.name, (productQty.get(item.name) ?? 0) + item.quantity);
  }
  const topProducts = [...productQty.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      <div className={`grid sm:grid-cols-3 ${canAccessAtividades ? "lg:grid-cols-4" : ""} gap-4 mb-8`}>
        <Stat label="Produtos" value={products.length} />
        <Stat label="Pedidos" value={orders.length} />
        <Stat label="Aguardando entrega" value={pendingDelivery} />
        {canAccessAtividades && (
          <Link
            href="/atividades"
            className={`rounded-lg p-5 border transition-colors ${overdueActivities > 0 ? "bg-red-50 border-red-200 hover:bg-red-100" : "bg-white border-slate-200 hover:bg-slate-50"}`}
          >
            <p className={`text-sm ${overdueActivities > 0 ? "text-red-700" : "text-slate-500"}`}>Atividades em atraso</p>
            <p className={`text-2xl font-bold ${overdueActivities > 0 ? "text-red-700" : "text-slate-900"}`}>{overdueActivities}</p>
          </Link>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <p className="text-sm text-slate-500">Total em pedidos</p>
        <p className="text-2xl font-bold text-slate-900">R$ {revenue.toFixed(2).replace(".", ",")}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Faturamento nos últimos 7 dias">
          <ColumnChart data={dailyRevenue} formatValue={(v) => `R$ ${v.toFixed(0)}`} />
        </ChartCard>

        <ChartCard title="Pedidos por status">
          {byStatus.length === 0 ? <EmptyChart /> : <BarChart data={byStatus} />}
        </ChartCard>

        <ChartCard title="Produtos mais vendidos" className="lg:col-span-2">
          {topProducts.length === 0 ? <EmptyChart /> : <BarChart data={topProducts} formatValue={(v) => `${v} un`} />}
        </ChartCard>
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

function ChartCard({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg p-5 ${className}`}>
      <h2 className="font-semibold text-slate-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <p className="text-sm text-slate-500 py-6 text-center">Sem dados suficientes ainda.</p>;
}

// Barras verticais (colunas) — usado pro faturamento diário.
function ColumnChart({ data, formatValue }: { data: { label: string; value: number }[]; formatValue: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
          <span className="text-[10px] text-slate-500">{d.value > 0 ? formatValue(d.value) : ""}</span>
          <div
            className="w-full bg-brand-500 rounded-t-sm min-h-[2px]"
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
          />
          <span className="text-[10px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// Barras horizontais — usado pro ranking de status e produtos.
function BarChart({ data, formatValue }: { data: { label: string; value: number }[]; formatValue?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span className="truncate pr-2">{d.label}</span>
            <span className="shrink-0 font-medium text-slate-900">{formatValue ? formatValue(d.value) : d.value}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
