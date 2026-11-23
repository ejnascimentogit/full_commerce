"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Customer, DeliveryRegion, Order, OrderDraft, SalesProduct, StoreSettings } from "@ecommerce/types";
import { apiClient, userCan } from "@ecommerce/api-client";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { money } from "@/lib/whatsapp";
import { ClientePicker } from "@/components/forca-vendas/ClientePicker";
import { FichaCliente } from "@/components/forca-vendas/FichaCliente";
import { PedidoEditor } from "@/components/forca-vendas/PedidoEditor";

type Step = { kind: "clientes" } | { kind: "ficha"; customer: Customer } | { kind: "pedido"; customer: Customer; draft?: OrderDraft } | { kind: "enviado"; order: Order; customer: Customer };

// Força de vendas (Comercial -> Vendas -> Pedidos -> + Novo pedido): carteira do vendedor -> ficha do cliente (conferir
// cadastro, plano, endereço e histórico) -> pedido em abas -> enviado. Pensado primeiro para o celular do vendedor.
export default function NovoPedidoPage() {
  const { user } = useAdminAuth();
  const allowed = userCan(user, "pedidos.criar");
  const [step, setStep] = useState<Step>({ kind: "clientes" });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drafts, setDrafts] = useState<OrderDraft[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [products, setProducts] = useState<SalesProduct[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user || !allowed) return;
    setLoading(true);
    Promise.all([apiClient.getSalesCustomers(), apiClient.getOrderDrafts(), apiClient.getStoreSettings()])
      .then(([c, d, s]) => {
        setCustomers(c ?? []);
        setDrafts(d ?? []);
        setSettings(s);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
    apiClient
      .getRegions({ includeInactive: true })
      .then((r) => setRegions(r ?? []))
      .catch(() => setRegions([]));
  }, [user, allowed]);

  // A tabela de produtos carrega assim que o vendedor abre a ficha, pra já estar pronta quando ele iniciar o pedido.
  useEffect(() => {
    if (step.kind !== "ficha" && step.kind !== "pedido") return;
    if (products !== null) return;
    apiClient
      .getSalesProducts()
      .then((p) => setProducts(p ?? []))
      .catch(() => setProducts([]));
  }, [step.kind, products]);

  async function deleteDraft(draft: OrderDraft) {
    await apiClient.deleteOrderDraft(draft.id).catch(() => undefined);
    setDrafts((current) => current.filter((d) => d.id !== draft.id));
  }

  function rememberDraft(saved: OrderDraft) {
    setDrafts((current) => [saved, ...current.filter((d) => d.id !== saved.id)]);
  }

  return (
    <AdminShell>
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/comercial/vendas?aba=pedidos" className="text-sm text-slate-500 hover:text-slate-800">
            Vendas
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-bold text-slate-900">Novo pedido</h1>
        </div>

        {user && !allowed ? (
          <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg p-4">
            Seu perfil não tem a permissão &ldquo;Digitar pedido (força de vendas)&rdquo;. Peça ao administrador em Configurações → Perfis de acesso.
          </p>
        ) : loadError ? (
          <p className="text-sm text-red-700 bg-red-50 rounded-lg p-4">Não deu para carregar a carteira. Atualize a página.</p>
        ) : step.kind === "clientes" ? (
          <ClientePicker
            customers={customers}
            drafts={drafts}
            loading={loading}
            onPick={(customer) => setStep({ kind: "ficha", customer })}
            onResumeDraft={(draft) => {
              const customer = customers.find((c) => c.id === draft.customerId);
              if (customer) setStep({ kind: "pedido", customer, draft });
            }}
            onDeleteDraft={deleteDraft}
          />
        ) : step.kind === "ficha" ? (
          <FichaCliente
            customer={step.customer}
            settings={settings}
            regions={regions}
            onBack={() => setStep({ kind: "clientes" })}
            onStart={() => setStep({ kind: "pedido", customer: step.customer })}
          />
        ) : step.kind === "pedido" && settings && user ? (
          <PedidoEditor
            key={step.draft?.id ?? step.customer.id}
            user={user}
            customer={step.customer}
            settings={settings}
            products={products}
            draft={step.draft}
            onBack={() => setStep({ kind: "ficha", customer: step.customer })}
            onDraftSaved={rememberDraft}
            onSent={(order) => {
              setDrafts((current) => current.filter((d) => d.id !== step.draft?.id));
              setStep({ kind: "enviado", order, customer: step.customer });
            }}
          />
        ) : step.kind === "enviado" ? (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
            <p className="text-4xl mb-2" aria-hidden>
              ✅
            </p>
            <h2 className="text-lg font-semibold text-slate-900">Pedido {step.order.orderNumber} enviado</h2>
            <p className="text-sm text-slate-500 mt-1">
              {step.customer.name} · {step.order.items.length} {step.order.items.length === 1 ? "item" : "itens"} · {money(step.order.total)}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center mt-5">
              <Link href={`/pedidos/${step.order.id}`} className="border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium px-4 py-2.5 rounded-md">
                Ver pedido
              </Link>
              <button
                type="button"
                onClick={() => setStep({ kind: "clientes" })}
                className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-md"
              >
                Novo pedido
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Carregando…</p>
        )}
      </div>
    </AdminShell>
  );
}
