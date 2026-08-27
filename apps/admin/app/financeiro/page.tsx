"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, PAYMENT_METHOD_LABEL } from "@ecommerce/api-client";
import type { Customer, Order } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

// Pedido cancelado/reembolsado não é dinheiro que entrou de verdade — não conta
// no poder de compra do cliente. Todo o resto (mesmo ainda em preparo/entrega)
// já foi pago, então conta.
const COMPLETED_STATUSES = new Set(["PAID", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"]);

function money(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface CustomerFinance {
  customer: Customer;
  orders: Order[];
  totalSpent: number;
  orderCount: number;
  avgTicket: number;
  lastPurchaseAt: string | null;
  topProducts: TopProduct[];
}

export default function FinanceiroPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Expande os itens do pedido na própria linha, em vez de navegar pra
  // /pedidos/[id] — com muitos pedidos, sair e voltar pra achar o pedido de
  // novo custa tempo demais. Vários podem ficar abertos ao mesmo tempo.
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  function toggleOrder(orderId: string) {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  useEffect(() => {
    if (user && user.role !== "platformAdmin") router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!user || user.role !== "platformAdmin") return;
    Promise.all([apiClient.getAdminCustomers(), apiClient.getAdminOrders()]).then(([c, o]) => {
      setCustomers(c);
      setOrders(o);
      setLoading(false);
    });
  }, [user]);

  const finances = useMemo(() => {
    const byCustomer = new Map<string, CustomerFinance>();
    for (const customer of customers) {
      byCustomer.set(customer.id, {
        customer,
        orders: [],
        totalSpent: 0,
        orderCount: 0,
        avgTicket: 0,
        lastPurchaseAt: null,
        topProducts: [],
      });
    }

    const productsByCustomer = new Map<string, Map<string, TopProduct>>();
    for (const order of orders) {
      if (!COMPLETED_STATUSES.has(order.status)) continue;
      const entry = byCustomer.get(order.customerId);
      if (!entry) continue;
      entry.orders.push(order);
      entry.totalSpent += order.total;
      entry.orderCount += 1;
      if (!entry.lastPurchaseAt || order.createdAt > entry.lastPurchaseAt) entry.lastPurchaseAt = order.createdAt;

      let products = productsByCustomer.get(order.customerId);
      if (!products) {
        products = new Map();
        productsByCustomer.set(order.customerId, products);
      }
      for (const item of order.items) {
        const revenue = item.finalSubtotal ?? item.estimatedSubtotal;
        const existing = products.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += revenue;
        } else {
          products.set(item.productId, { name: item.name, quantity: item.quantity, revenue });
        }
      }
    }

    for (const [customerId, entry] of byCustomer) {
      entry.avgTicket = entry.orderCount > 0 ? entry.totalSpent / entry.orderCount : 0;
      entry.orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const products = productsByCustomer.get(customerId);
      entry.topProducts = products ? [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5) : [];
    }
    return byCustomer;
  }, [customers, orders]);

  const ranked = useMemo(
    () => [...finances.values()].filter((f) => f.orderCount > 0).sort((a, b) => b.totalSpent - a.totalSpent),
    [finances],
  );

  const term = search.trim().toLowerCase();
  const filteredRanked = term
    ? ranked.filter(
        (f) =>
          f.customer.name.toLowerCase().includes(term) ||
          f.customer.email.toLowerCase().includes(term) ||
          (f.customer.code ?? "").toLowerCase().includes(term),
      )
    : ranked;

  const totals = useMemo(
    () => ({
      revenue: ranked.reduce((sum, f) => sum + f.totalSpent, 0),
      orders: ranked.reduce((sum, f) => sum + f.orderCount, 0),
      customers: ranked.length,
    }),
    [ranked],
  );

  const selected = selectedId ? finances.get(selectedId) : undefined;

  if (user?.role !== "platformAdmin") return null;

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
        <p className="text-sm text-slate-500 mt-1">
          Extrato de compras por cliente — só pedidos pagos contam (cancelados e reembolsados ficam de fora).
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase mb-1">Faturamento total</p>
              <p className="text-xl font-bold text-slate-900">{money(totals.revenue)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase mb-1">Pedidos pagos</p>
              <p className="text-xl font-bold text-slate-900">{totals.orders}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase mb-1">Clientes compradores</p>
              <p className="text-xl font-bold text-slate-900">{totals.customers}</p>
            </div>
          </div>

          <div className="grid grid-cols-[22rem_1fr] gap-5 items-start">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-slate-100">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                />
              </div>
              <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
                {filteredRanked.map((f) => (
                  <li key={f.customer.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(f.customer.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${selectedId === f.customer.id ? "bg-brand-50" : ""}`}
                    >
                      <p className="text-sm font-medium text-slate-900">{f.customer.name}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-slate-500">
                          {f.orderCount} pedido{f.orderCount === 1 ? "" : "s"}
                        </span>
                        <span className="text-sm font-semibold text-brand-700">{money(f.totalSpent)}</span>
                      </div>
                    </button>
                  </li>
                ))}
                {filteredRanked.length === 0 && (
                  <li className="text-sm text-slate-500 p-6 text-center">Nenhum cliente encontrado.</li>
                )}
              </ul>
            </div>

            <div>
              {!selected ? (
                <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-500">
                  Selecione um cliente na lista para ver o extrato completo.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">{selected.customer.name}</h2>
                        {selected.customer.businessName && (
                          <p className="text-sm text-slate-500">{selected.customer.businessName}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {selected.customer.email} · {selected.customer.document}
                        </p>
                      </div>
                      <Link href="/clientes" className="text-xs text-brand-600 hover:underline shrink-0">
                        Editar cadastro
                      </Link>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-slate-50 rounded-md p-3">
                        <p className="text-xs text-slate-500 mb-0.5">Total gasto</p>
                        <p className="text-base font-bold text-slate-900">{money(selected.totalSpent)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-md p-3">
                        <p className="text-xs text-slate-500 mb-0.5">Pedidos</p>
                        <p className="text-base font-bold text-slate-900">{selected.orderCount}</p>
                      </div>
                      <div className="bg-slate-50 rounded-md p-3">
                        <p className="text-xs text-slate-500 mb-0.5">Ticket médio</p>
                        <p className="text-base font-bold text-slate-900">{money(selected.avgTicket)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-md p-3">
                        <p className="text-xs text-slate-500 mb-0.5">Última compra</p>
                        <p className="text-base font-bold text-slate-900">
                          {selected.lastPurchaseAt ? new Date(selected.lastPurchaseAt).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selected.topProducts.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-lg p-5">
                      <h3 className="text-sm font-semibold text-slate-900 mb-3">Produtos mais comprados</h3>
                      <ul className="space-y-2">
                        {selected.topProducts.map((p) => (
                          <li key={p.name} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700">{p.name}</span>
                            <span className="text-slate-500">
                              {p.quantity}x · <span className="font-medium text-slate-900">{money(p.revenue)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <h3 className="text-sm font-semibold text-slate-900 px-5 py-3 border-b border-slate-100">
                      Histórico de pedidos
                    </h3>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                        <tr>
                          <th className="text-left px-4 py-2.5">Pedido</th>
                          <th className="text-left px-4 py-2.5">Data</th>
                          <th className="text-left px-4 py-2.5">Itens</th>
                          <th className="text-left px-4 py-2.5">Pagamento</th>
                          <th className="text-right px-4 py-2.5">Valor</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selected.orders.map((order) => {
                          const expanded = expandedOrderIds.has(order.id);
                          return (
                            <Fragment key={order.id}>
                              <tr className={expanded ? "bg-brand-50/60" : undefined}>
                                <td className="px-4 py-2.5 font-medium text-slate-900">{order.orderNumber}</td>
                                <td className="px-4 py-2.5 text-slate-500">
                                  {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500">
                                  {order.items.length} ite{order.items.length === 1 ? "m" : "ns"}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</td>
                                <td className="px-4 py-2.5 text-right font-medium text-slate-900">{money(order.total)}</td>
                                <td className="px-4 py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => toggleOrder(order.id)}
                                    className={`text-xs font-medium rounded px-2 py-1 ${expanded ? "bg-brand-600 text-white hover:bg-brand-700" : "text-brand-600 hover:bg-brand-50"}`}
                                  >
                                    {expanded ? "Ocultar" : "Ver"}
                                  </button>
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="bg-slate-100">
                                  <td colSpan={6} className="px-4 py-3">
                                    <div className="bg-white border border-slate-200 border-l-4 border-l-brand-500 rounded-md shadow-sm p-3">
                                      <table className="w-full text-sm">
                                        <thead className="text-slate-500 text-xs uppercase bg-slate-50">
                                          <tr>
                                            <th className="text-left py-1.5 px-2 font-medium">Produto</th>
                                            <th className="text-right py-1.5 px-2 font-medium">Qtd</th>
                                            <th className="text-right py-1.5 px-2 font-medium">Preço unit.</th>
                                            <th className="text-right py-1.5 px-2 font-medium">Subtotal</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {order.items.map((item) => (
                                            <tr key={item.productId}>
                                              <td className="py-1.5 px-2 text-slate-700">{item.name}</td>
                                              <td className="py-1.5 px-2 text-right text-slate-500">{item.quantity}</td>
                                              <td className="py-1.5 px-2 text-right text-slate-500">{money(item.unitPrice)}</td>
                                              <td className="py-1.5 px-2 text-right font-medium text-slate-900">
                                                {money(item.finalSubtotal ?? item.estimatedSubtotal)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      <div className="flex items-center justify-between mt-2 pt-2 px-2 border-t border-slate-200">
                                        <Link href={`/pedidos/${order.id}`} className="text-xs text-brand-600 hover:underline">
                                          Abrir pedido completo →
                                        </Link>
                                        <div className="flex gap-4 text-xs text-slate-500">
                                          <span>
                                            Subtotal <span className="font-medium text-slate-900">{money(order.subtotal)}</span>
                                          </span>
                                          <span>
                                            Frete <span className="font-medium text-slate-900">{money(order.shipping)}</span>
                                          </span>
                                          <span>
                                            Total <span className="font-semibold text-slate-900">{money(order.total)}</span>
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
