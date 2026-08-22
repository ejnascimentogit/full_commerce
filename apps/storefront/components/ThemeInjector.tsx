"use client";

import { useEffect } from "react";
import { apiClient, deriveBrandPalette } from "@ecommerce/api-client";

// Sem output visual — só aplica a cor de marca configurada no admin como CSS
// custom properties no <html>, sobrescrevendo os defaults de globals.css.
// Client-only pelo mesmo motivo do LogoLink: os dados vêm de localStorage.
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
    });
  }, []);

  return null;
}
