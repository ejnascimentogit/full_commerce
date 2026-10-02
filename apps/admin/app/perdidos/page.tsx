"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient, unitPriceOf } from "@ecommerce/api-client";
import type { Cart, Customer, Product } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { WhatsappButton, WhatsappPanel } from "@/components/WhatsappMessage";
import { productList } from "@/lib/whatsapp";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysStalled(cart: Cart): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(cart.updatedAt)) / DAY_MS));
}

function money(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

interface CustomerGroup {
  customerId: string;
  customer: Customer | undefined;
  carts: Cart[];
  lastUpdate: number;
}

// Carrinhos com produtos que o cliente escolheu e nao finalizou (nem pedido, nem orcamento).
// Um cliente pode ter varios -- o vendedor ve tudo junto, com o contato, pra entrar em contato e
// tentar reverter a venda. So leitura: o carrinho nao tem endereco/pagamento confirmados, entao nao
// existe acao de conversao aqui.
export default function PerdidosPage() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, Customer>>({});
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [whatsappOpenId, setWhatsappOpenId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<{ customerId: string; createdAt: string; productIds: Set<string> }[]>([]);

  useEffect(() => {
    apiClient.getAdminCarts().then(setCarts);
    apiClient.getAdminCustomers().then((customers) => {
      setCustomersById(Object.fromEntries(customers.map((c) => [c.id, c])));
    });
  }, []);

  useEffect(() => {
    Promise.all([apiClient.getAdminOrders().catch(() => []), apiClient.getAdminQuotes().catch(() => [])]).then(([orders, quotes]) => {
      setPurchases(
        [...orders, ...quotes].map((p) => ({
          customerId: p.customerId,
          createdAt: p.createdAt,
          productIds: new Set(p.items.map((item) => item.productId)),
        })),
      );
    });
  }, []);

  // O carrinho nao guarda preco -- o valor mostrado e sempre o do produto hoje.
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

  // Carrinho que ja virou pedido ou orcamento (do mesmo cliente, feito depois da ultima mexida e com todos
  // os produtos do carrinho) nao e venda perdida: sai da lista.
  const openCarts = useMemo(
    () =>
      carts.filter(
        (cart) =>
          !purchases.some(
            (p) =>
              p.customerId === cart.customerId &&
              Date.parse(p.createdAt) >= Date.parse(cart.updatedAt) &&
              cart.items.every((item) => p.productIds.has(item.productId)),
          ),
      ),
    [carts, purchases],
  );

  // Quem abandonou mais vezes aparece primeiro (mais chance de querer comprar), depois o mais recente.
  const groups = useMemo<CustomerGroup[]>(() => {
    const byCustomer = new Map<string, Cart[]>();
    for (const cart of openCarts) byCustomer.set(cart.customerId, [...(byCustomer.get(cart.customerId) ?? []), cart]);
    return [...byCustomer.entries()]
      .map(([customerId, list]) => ({
        customerId,
        customer: customersById[customerId],
        carts: [...list].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
        lastUpdate: Math.max(...list.map((cart) => Date.parse(cart.updatedAt))),
      }))
      .sort((a, b) => b.carts.length - a.carts.length || b.lastUpdate - a.lastUpdate);
  }, [openCarts, customersById]);

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Perdidos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Carrinhos com produtos que o cliente escolheu e não finalizou. Entre em contato pra tentar reverter a venda.
        </p>
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const phone = group.customer?.phone;
          const total = group.carts.reduce((sum, cart) => sum + valueOf(cart), 0);
          const many = group.carts.length > 1;
          return (
            <section key={group.customerId} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{group.customer?.name ?? "Cliente não encontrado"}</h2>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${many ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {group.carts.length} {many ? "carrinhos abandonados" : "carrinho abandonado"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {[phone, group.customer?.email].filter(Boolean).join(" | ") || "Sem contato cadastrado"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">
                    Total em carrinhos: <strong className="text-slate-900">{money(total)}</strong>
                  </span>
                </div>
              </header>
              <ul className="divide-y divide-slate-100">
                {group.carts.map((cart) => {
                  const days = daysStalled(cart);
                  return (
                    <li key={cart.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-slate-500">
                          Atualizado em {new Date(cart.updatedAt).toLocaleString("pt-BR")}
                          {days >= 1 && (
                            <span className="ml-2 text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                              parado há {days} {days === 1 ? "dia" : "dias"}
                            </span>
                          )}
                        </span>
                        <span className="font-medium text-slate-900">
                          {money(valueOf(cart))}
                          <WhatsappButton open={whatsappOpenId === cart.id} onClick={() => setWhatsappOpenId(whatsappOpenId === cart.id ? null : cart.id)} />
                        </span>
                      </div>
                      <ul className="mt-2 text-sm text-slate-700 space-y-0.5">
                        {cart.items.map((item) => (
                          <li key={item.productId}>
                            {item.quantity}x {productsById[item.productId]?.name ?? "Produto indisponível"}
                          </li>
                        ))}
                      </ul>
                      {whatsappOpenId === cart.id && (
                        <div className="mt-3">
                          <WhatsappPanel
                            kind="perdidos"
                            customer={group.customer}
                            vars={{
                              valor: money(valueOf(cart)),
                              produtos: productList(cart.items.map((item) => ({ name: productsById[item.productId]?.name ?? "Produto", quantity: item.quantity }))),
                              dias: days >= 1 ? `há ${days} ${days === 1 ? "dia" : "dias"}` : "hoje",
                            }}
                            onClose={() => setWhatsappOpenId(null)}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {!loading && groups.length === 0 && (
        <p className="text-sm text-slate-500 p-6 text-center bg-white border border-slate-200 rounded-lg">
          Nenhum carrinho abandonado no momento.
        </p>
      )}
    </AdminShell>
  );
}
