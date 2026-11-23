"use client";

import { useEffect, useState } from "react";
import type { Customer, DeliveryRegion, Order, StoreSettings } from "@ecommerce/types";
import { apiClient, customerNumber, formatDocument, formatPhone, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@ecommerce/api-client";
import { money } from "@/lib/whatsapp";
import { Card, daysSince, Field, planLabel, shortDate, Tabs } from "./shared";

type FichaTab = "cadastro" | "plano" | "endereco" | "historico";

// Passo 2: conferir o cadastro antes de digitar (igual à ficha do cliente nos apps de força de vendas). Só leitura:
// corrigir cadastro continua sendo em Clientes, por quem tem permissão.
export function FichaCliente({
  customer,
  settings,
  regions,
  onStart,
  onBack,
}: {
  customer: Customer;
  settings: StoreSettings | null;
  regions: DeliveryRegion[];
  onStart: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<FichaTab>("cadastro");
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    setOrders(null);
    apiClient
      .getSalesCustomerOrders(customer.id)
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [customer.id]);

  const region = regions.find((r) => r.id === customer.regionId);
  const validOrders = (orders ?? []).filter((o) => o.status !== "CANCELLED" && o.status !== "REFUNDED");
  const lastOrder = validOrders[0];
  const avgTicket = validOrders.length ? validOrders.reduce((s, o) => s + o.total, 0) / validOrders.length : 0;

  return (
    <div>
      <button type="button" onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 mb-3">
        ‹ Trocar cliente
      </button>
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        {customer.code && <p className="text-xs font-mono text-slate-500">Cliente {customerNumber(customer.code)}</p>}
        <h2 className="text-lg font-semibold text-slate-900">{customer.name}</h2>
        {customer.businessName && <p className="text-sm text-slate-500">{customer.businessName}</p>}
        <div className="flex flex-wrap gap-2 mt-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full ${customer.status === "active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {customer.status === "active" ? "Ativo" : "Inativo"}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{planLabel(customer.preferredPaymentMethod)}</span>
          <span className={`px-2 py-0.5 rounded-full ${region ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-700"}`}>
            {region ? `Rota: ${region.name}` : "Sem rota de entrega"}
          </span>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "cadastro", label: "Cadastro" },
          { id: "plano", label: "Plano de pagamento" },
          { id: "endereco", label: "Endereço de entrega", badge: customer.addresses.length, badgeTone: "neutral" },
          { id: "historico", label: "Histórico", badge: orders?.length ?? 0, badgeTone: "neutral" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "cadastro" && (
        <Card>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={customer.documentType === "cnpj" ? "CNPJ" : "CPF"} value={formatDocument(customer.documentType, customer.document)} />
            <Field label="Razão social" value={customer.businessName} />
            <Field label="E-mail" value={customer.email} />
            <Field label="Telefone" value={customer.phone ? formatPhone(customer.phone) : undefined} />
            <Field label="Código de referência" value={customer.referenceCode} />
            <Field label="Cliente desde" value={shortDate(customer.createdAt)} />
          </dl>
        </Card>
      )}

      {tab === "plano" && (
        <Card>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Plano do cadastro" value={planLabel(customer.preferredPaymentMethod)} />
            <Field
              label="Formas ligadas na loja"
              value={(settings?.enabledPaymentMethods ?? []).map((m) => PAYMENT_METHOD_LABEL[m]).join(", ")}
            />
            <Field label="Parcelamento no cartão" value={settings ? `até ${settings.maxInstallments}x` : undefined} />
            <Field label="Pedido mínimo" value={settings?.minOrderValue ? money(settings.minOrderValue) : "Sem mínimo"} />
            <Field
              label="Frete"
              value={
                settings
                  ? customer.documentType === "cnpj" && settings.freeShippingForCnpj
                    ? "Grátis (CNPJ)"
                    : money(settings.shippingCost)
                  : undefined
              }
            />
          </dl>
          {!customer.preferredPaymentMethod && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-md p-2 mt-3">
              Cliente sem plano no cadastro: no pedido você escolhe entre as formas ligadas na loja.
            </p>
          )}
        </Card>
      )}

      {tab === "endereco" &&
        (customer.addresses.length === 0 ? (
          <Card>
            <p className="text-sm text-red-700">Cliente sem endereço de entrega. Cadastre em Clientes antes de digitar o pedido.</p>
          </Card>
        ) : (
          customer.addresses.map((a) => (
            <Card key={a.id} title={a.label || (a.isDefault ? "Endereço padrão" : "Endereço")}>
              <p className="text-sm text-slate-900">
                {a.street}, {a.number}
                {a.complement ? ` — ${a.complement}` : ""}
              </p>
              <p className="text-sm text-slate-600">
                {a.neighborhood} · {a.city}/{a.state} · CEP {a.zipCode}
              </p>
              {a.isDefault && <p className="text-xs text-brand-700 mt-1">Padrão para entrega</p>}
            </Card>
          ))
        ))}

      {tab === "historico" && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="Pedidos" value={orders ? String(validOrders.length) : "…"} />
            <Stat label="Último pedido" value={lastOrder ? `${daysSince(lastOrder.createdAt)} dias` : "—"} />
            <Stat label="Ticket médio" value={validOrders.length ? money(avgTicket) : "—"} />
          </div>
          {orders === null ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : orders.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">Nenhum pedido ainda.</p>
            </Card>
          ) : (
            <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
              {orders.map((o) => (
                <li key={o.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-medium text-slate-900 w-24 shrink-0">{o.orderNumber}</span>
                  <span className="text-slate-500 flex-1">
                    {shortDate(o.createdAt)} · {o.items.length} {o.items.length === 1 ? "item" : "itens"}
                    {o.origin === "painel" && o.sellerName ? ` · ${o.sellerName}` : ""}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 hidden sm:inline">{ORDER_STATUS_LABEL[o.status]}</span>
                  <span className="text-slate-900">{money(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="sticky bottom-0 -mx-4 md:-mx-8 mt-4 bg-white border-t border-slate-200 px-4 md:px-8 py-3 flex justify-end z-20">
        <button
          type="button"
          onClick={onStart}
          disabled={customer.status !== "active" || customer.addresses.length === 0}
          className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-md"
        >
          Iniciar pedido
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
