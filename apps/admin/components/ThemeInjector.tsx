"use client";

import { useEffect } from "react";
import { apiClient, deriveBrandPalette, type BrandPalette } from "@ecommerce/api-client";

const CACHE_KEY = "ecommerce.theme.palette";

function applyPalette(palette: BrandPalette) {
  const root = document.documentElement.style;
  root.setProperty("--color-brand-50", palette["50"]);
  root.setProperty("--color-brand-100", palette["100"]);
  root.setProperty("--color-brand-500", palette["500"]);
  root.setProperty("--color-brand-600", palette["600"]);
  root.setProperty("--color-brand-700", palette["700"]);
}

// Mesmo mecanismo do ThemeInjector da loja: o admin também reflete a cor de
// marca configurada em Configurações, em vez de ficar sempre no azul padrão
// — o painel é a cara da mesma empresa que a loja. Cache em localStorage
// evita o flash da cor padrão a cada carregamento.
export function ThemeInjector() {
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        applyPalette(JSON.parse(cached));
      } catch {
        // cache corrompido, ignora — a chamada à API abaixo corrige
      }
    }

    apiClient.getStoreSettings().then((settings) => {
      const palette = deriveBrandPalette(settings.brandColor);
      applyPalette(palette);
      localStorage.setItem(CACHE_KEY, JSON.stringify(palette));
    });
  }, []);

  return null;
}
