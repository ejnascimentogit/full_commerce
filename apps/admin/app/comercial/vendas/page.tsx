"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { PedidosTab } from "@/components/comercial/PedidosTab";
import { OrcamentosTab } from "@/components/comercial/OrcamentosTab";
import { PerdidosTab } from "@/components/comercial/PerdidosTab";

const TABS = [
  { id: "pedidos", label: "Pedidos" },
  { id: "orcamentos", label: "Orçamentos" },
  { id: "perdidos", label: "Perdidos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Pedidos, Orçamentos e Perdidos numa tela só, separados por abas. A aba ativa fica na URL (?aba=...) pra o
// botão voltar e os favoritos funcionarem; as telas de cada aba são as mesmas de antes.
function VendasContent() {
  const params = useSearchParams();
  const requested = params.get("aba");
  const active: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : "pedidos";

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Vendas</h1>
      <div className="flex gap-1 border-b border-slate-200 mb-6" role="tablist">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/comercial/vendas?aba=${tab.id}`}
            replace
            role="tab"
            aria-selected={active === tab.id}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${active === tab.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {active === "pedidos" && <PedidosTab />}
      {active === "orcamentos" && <OrcamentosTab />}
      {active === "perdidos" && <PerdidosTab />}
    </AdminShell>
  );
}

export default function VendasPage() {
  return (
    <Suspense fallback={null}>
      <VendasContent />
    </Suspense>
  );
}
