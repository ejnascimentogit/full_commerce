import type { StoreSettings } from "@ecommerce/types";
import { placeholderPhoto } from "./placeholder";

const STORAGE_KEY = "ecommerce.mock.settings";

function seedSettings(): StoreSettings {
  return {
    brandColor: "#1d4ed8",
    banners: [
      {
        id: "banner-seed-1",
        imageUrl: placeholderPhoto("banner-1", "Ofertas"),
        title: "Ofertas da semana pra o seu negócio",
        linkUrl: "/catalogo?promo=semana",
        order: 0,
        active: true,
      },
      {
        id: "banner-seed-2",
        imageUrl: placeholderPhoto("banner-2", "Cadastre-se"),
        title: "Crie sua conta e ganhe frete grátis (CNPJ)",
        linkUrl: "/conta/criar",
        order: 1,
        active: true,
      },
    ],
  };
}

function readSettings(): StoreSettings {
  if (typeof window === "undefined") return seedSettings();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed
    }
  }
  const seeded = seedSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeSettings(settings: StoreSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getSettings(): StoreSettings {
  return readSettings();
}

export function updateSettings(patch: Partial<StoreSettings>): StoreSettings {
  const settings = { ...readSettings(), ...patch };
  writeSettings(settings);
  return settings;
}
