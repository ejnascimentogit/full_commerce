"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ORDER_STATUS_LABEL } from "@ecommerce/api-client";
import type { Category, Order } from "@ecommerce/types";
import { Header } from "@/components/Header";
import { RegionBar } from "@/components/RegionBar";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function ContaPage() {
  const { customer, loading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    apiClient.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!customer) return;
    apiClient.getCustomerOrders(customer.id).then(setOrders);
  }, [customer]);

  useEffect(() => {
    if (!loading && !customer) router.replace("/conta/entrar?redirect=/conta");
  }, [loading, customer, router]);

  if (loading || !customer) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Carregando...</div>;
  }

  return (
    <>
      <RegionBar />
      <Header categories={categories} />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Minha conta</h1>

        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-semibold text-slate-900 mb-3">Dados cadastrais</h2>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Nome</dt>
              <dd className="text-slate-900 font-medium">{customer.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Seu código</dt>
              <dd className="text-slate-900 font-medium font-mono">{customer.code ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Razão social</dt>
              <dd className="text-slate-900 font-medium">{customer.businessName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{customer.documentType.toUpperCase()}</dt>
              <dd className="text-slate-900 font-medium">{customer.document}</dd>
            </div>
            <div>
              <dt className="text-slate-500">E-mail</dt>
              <dd className="text-slate-900 font-medium">{customer.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Telefone</dt>
              <dd className="text-slate-900 font-medium">{customer.phone}</dd>
            </div>
          </dl>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-semibold text-slate-900 mb-3">Endereços</h2>
          {customer.addresses.length === 0 && <p className="text-sm text-slate-500">Nenhum endereço cadastrado ainda.</p>}
          <ul className="space-y-2 text-sm">
            {customer.addresses.map((a) => (
              <li key={a.id} className="text-slate-600">
                {a.street}, {a.number} — {a.neighborhood}, {a.city}/{a.state} — {a.zipCode}
                {a.isDefault && <span className="ml-2 text-brand-600 text-xs font-medium">(padrão)</span>}
              </li>
            ))}
          </ul>
        </section>

        <Link
          href="/conta/pedidos"
          className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-brand-300"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Minhas compras</h2>
            <span className="text-sm font-medium text-brand-600">Ver todos os pedidos →</span>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-500">Você ainda não fez nenhum pedido.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
                <div>
                  <p className="text-slate-500">Pedidos feitos</p>
                  <p className="text-slate-900 font-bold text-lg">{orders.length}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total comprado</p>
                  <p className="text-slate-900 font-bold text-lg">
                    R$ {orders.reduce((sum, o) => sum + o.total, 0).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Último pedido</p>
                  <p className="text-slate-900 font-medium">{new Date(orders[0].createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Pedido mais recente: {orders[0].orderNumber} — {ORDER_STATUS_LABEL[orders[0].status]}
              </p>
            </>
          )}
        </Link>
      </div>
    </>
  );
}
