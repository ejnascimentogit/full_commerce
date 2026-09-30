"use client";

import { useEffect, useState } from "react";
import { apiClient, unitPriceOf } from "@ecommerce/api-client";
import type { Cart, Customer, Product } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";

function daysStalled(cart: Cart): number {
  const start = new Date(cart.updatedAt).getTime();
  return Math.max(0, Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000)));
}

function itemCountOf(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

// Read-only view of carts with at least 1 item that never turned into an
// Order or a Quote. Unlike those two, a cart has no confirmed address/payment
// method, so there is no conversion action here, only visibility for the
// sales team.
export default function PerdidosPage() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, Customer>>({});
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getAdminCarts().then(setCarts);
    apiClient.getAdminCustomers().then((customers) => {
      setCustomersById(Object.fromEntries(customers.map((c) => [c.id, c])));
    });
  }, []);

  // The cart never stores a price (see CartItem) -- the displayed value is
  // always resolved live from the current product, same pattern the
  // storefront's own cart page already uses.
  useEffect(() => {
    const ids = new Set<string>();
    carts.forEach((cart) => cart.items.forEach((item) => ids.add(item.productId)));
    const missing = [...ids].filter((id) => !productsById[id]);
    if (missing.length === 0) {
      setLoading(false);
      return;
    }
    Promise.all(missing.map((id) => apiClient.getProduct(id).catch(() => null))).then((fetched) => {
      const valid = fetched.filter((p): p is Product => Boolean(p));
      setProductsById((prev) => ({ ...prev, ...Object.fromEntries(valid.map((p) => [p.id, p])) }));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carts]);

  function valueOf(cart: Cart): number {
    return cart.items.reduce((sum, item) => {
      const product = productsById[item.productId];
      return product ? sum + unitPriceOf(product) * item.quantity : sum;
    }, 0);
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Perdidos</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Cliente</th>
              <th className="text-left px-4 py-2.5">Itens</th>
              <th className="text-right px-4 py-2.5">Valor atual</th>
              <th className="text-left px-4 py-2.5">Atualizado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {carts.map((cart) => {
              const customer = customersById[cart.customerId];
              const count = itemCountOf(cart);
              const days = daysStalled(cart);
              return (
                <tr key={cart.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{customer?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {count} {count === 1 ? "item" : "itens"}
                  </td>
                  <td className="px-4 py-2.5 text-right">R$ {valueOf(cart).toFixed(2).replace(".", ",")}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(cart.updatedAt).toLocaleString("pt-BR")}
                    {days >= 1 && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                        parado ha {days} {days === 1 ? "dia" : "dias"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && carts.length === 0 && (
          <p className="text-sm text-slate-500 p-6 text-center">Nenhum carrinho em aberto no momento.</p>
        )}
      </div>
    </AdminShell>
  );
}
