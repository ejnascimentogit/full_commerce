"use client";

import type { Customer, PaymentMethod } from "@ecommerce/types";
import { PAYMENT_METHOD_LABEL } from "@ecommerce/api-client";

// Peças pequenas usadas nas três telas da força de vendas (carteira, ficha do cliente e pedido).

export function planLabel(method?: PaymentMethod): string {
  return method ? PAYMENT_METHOD_LABEL[method] : "Sem plano no cadastro";
}

export function defaultAddressId(customer: Customer): string | undefined {
  return (customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0])?.id;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Abas no estilo das outras telas do painel; rola de lado no celular quando não cabem. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; badge?: number; badgeTone?: "error" | "neutral" }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto -mx-1 px-1" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 px-3 py-2 text-sm font-medium -mb-px border-b-2 whitespace-nowrap ${
            active === tab.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {tab.label}
          {tab.badge != null && tab.badge > 0 && (
            <span
              className={`ml-1.5 inline-block min-w-5 px-1.5 rounded-full text-xs ${
                tab.badgeTone === "error" ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900 break-words">{value || "—"}</dd>
    </div>
  );
}

export function Card({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 mb-3">
      {(title || action) && (
        <div className="flex items-center justify-between mb-3 gap-2">
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
