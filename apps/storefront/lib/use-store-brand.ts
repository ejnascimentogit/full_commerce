"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ecommerce/api-client";

export interface StoreBrand {
  storeName: string;
  logoUrl: string | null;
}

// Ultima identidade conhecida desta loja/admin. Cada empresa tem o proprio endereco, entao o cache do navegador
// nunca mistura empresas. Serve pra nunca mostrar o nome padrao ("fullcommerce") enquanto a API ainda nao respondeu.
const CACHE_KEY = "ecommerce.brand";

export function useStoreBrand(kind: "storefront" | "admin"): StoreBrand | null {
  const [brand, setBrand] = useState<StoreBrand | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) setBrand(JSON.parse(cached) as StoreBrand);
    } catch {}
    apiClient
      .getStoreSettings()
      .then((s) => {
        if (cancelled) return;
        const fresh = { storeName: s.siteCopy.storeName, logoUrl: s.logoUrl ?? null };
        setBrand(fresh);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
        } catch {}
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!brand?.storeName) return;
    document.title = kind === "admin" ? `Painel Admin | ${brand.storeName}` : `${brand.storeName} | Loja B2B`;
  }, [brand, kind]);

  return brand;
}
