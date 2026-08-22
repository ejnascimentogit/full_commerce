"use client";

import { useEffect } from "react";
import { apiClient, deriveBrandPalette } from "@ecommerce/api-client";

// Sem output visual — só aplica a cor de marca e o nome da loja configurados no
// admin como CSS custom properties / <title>, sobrescrevendo os defaults de
// globals.css e layout.tsx. Client-only pelo mesmo motivo do LogoLink: os dados
// vêm de localStorage.
export function ThemeInjector() {
  useEffect(() => {
    apiClient.getStoreSettings().then((settings) => {
      const palette = deriveBrandPalette(settings.brandColor);
      const root = document.documentElement.style;
      root.setProperty("--color-brand-50", palette[50]);
      root.setProperty("--color-brand-100", palette[100]);
      root.setProperty("--color-brand-500", palette[500]);
      root.setProperty("--color-brand-600", palette[600]);
      root.setProperty("--color-brand-700", palette[700]);
      document.title = `${settings.siteCopy.storeName} | Loja B2B`;
    });
  }, []);

  return null;
}
