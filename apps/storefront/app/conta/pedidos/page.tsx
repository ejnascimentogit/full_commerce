"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ORDER_STATUS_LABEL } from "@ecommerce/api-client";
import type { Category, Order } from "@ecommerce/types";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { useAuth } from "@/lib/auth-context";

export default function MeusPedidosPage() {
  const { customer, loading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    apiClient.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!loading && !customer) {
      router.replace("/conta/entrar?redirect=/conta/pedidos");
      return;
    }
    if (customer) apiClient.getCustomerOrders(customer.id).then(setOrders);
  }, [loading, customer, router]);

  if (loading || !customer) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Carregando...</div>;
  }

  return (
    <>
      <RegionBar />
      <Header categories={categories} />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Meus pedidos</h1>

        {orders?.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
            <p className="text-slate-600">Você ainda não fez nenhum pedido.</p>
            <Link href="/catalogo" className="mt-3 inline-block text-brand-600 font-medium hover:underline">
              Ir para o catálogo
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {orders?.map((order) => (
            <Link
              key={order.id}
              href={`/pedido/${order.id}`}
              className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-brand-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                  <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className="text-sm font-medium text-brand-600">{ORDER_STATUS_LABEL[order.status]}</span>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                {order.items.length} {order.items.length === 1 ? "item" : "itens"} · R${" "}
                {order.total.toFixed(2).replace(".", ",")}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
