"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@ecommerce/api-client";
import { useAuth } from "@/lib/auth-context";

// A região não é mais escolhida pelo visitante — é resolvida pelo bairro do
// endereço do cliente (roteirização feita pelo admin). Por isso esta barra busca
// seus próprios dados em vez de receber uma "região atual" como prop.
export function RegionBar() {
  const { customer, loading } = useAuth();
  const [regionName, setRegionName] = useState<string | null>(null);

  useEffect(() => {
    if (!customer?.regionId) return;
    apiClient.getRegions().then((regions) => {
      setRegionName(regions.find((r) => r.id === customer.regionId)?.name ?? null);
    });
  }, [customer]);

  if (loading) return null;

  if (!customer) {
    return (
      <div className="bg-brand-700 text-white text-sm">
        <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-1.5">
          <span aria-hidden>🛒</span>
          <span>Sem pedido mínimo · Frete grátis para CNPJ</span>
          <Link href="/conta/criar" className="ml-1 underline decoration-dotted underline-offset-2 hover:text-brand-100">
            crie sua conta pra ver o prazo de entrega
          </Link>
        </div>
      </div>
    );
  }

  if (!customer.regionId) {
    return (
      <div className="bg-amber-600 text-white text-sm">
        <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-1.5">
          <span aria-hidden>📍</span>
          <span>
            Ainda não atendemos {customer.addresses[0]?.neighborhood ?? "sua região"} — sua conta já está pronta,
            avisamos assim que a entrega for liberada por aí.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-700 text-white text-sm">
      <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-1.5">
        <span aria-hidden>📍</span>
        <span>
          Você está em <strong className="font-semibold">{regionName ?? "..."}</strong>
        </span>
      </div>
    </div>
  );
}
