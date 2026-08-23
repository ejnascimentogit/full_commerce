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

// Sem output visual — só aplica a cor de marca e o nome da loja configurados no
// admin como CSS custom properties / <title>, sobrescrevendo os defaults de
// globals.css e layout.tsx. Client-only pelo mesmo motivo do LogoLink: os dados
// vêm de localStorage.
//
// A cor é aplicada em duas etapas pra evitar o "flash" da cor padrão (azul) em
// todo carregamento de página: primeiro, de forma síncrona, a última cor
// conhecida (cache em localStorage); depois, quando a chamada à API responde,
// a cor de verdade (que pode ter mudado desde o último cache).
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
      document.title = `${settings.siteCopy.storeName} | Loja B2B`;
    });
  }, []);

  return null;
}
