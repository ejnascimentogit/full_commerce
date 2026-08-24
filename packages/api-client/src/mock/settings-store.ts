import type { FooterLink, StoreSettings } from "@ecommerce/types";
import { placeholderPhoto } from "./placeholder";

const STORAGE_KEY = "ecommerce.mock.settings";

function seedSettings(): StoreSettings {
  return {
    brandColor: "#1d4ed8",
    promotionsEnabled: true,
    siteCopy: {
      storeName: "fullcommerce",
      heroTitle: "A melhor forma de abastecer o seu negócio.",
      featureBullets: [
        { icon: "🛒", title: "Sem pedido mínimo", text: "Seu pedido não precisa ser grande para ser importante." },
        { icon: "🚚", title: "Frete grátis para CNPJ", text: "Faça quantos pedidos desejar, o frete é por nossa conta." },
        { icon: "⏱️", title: "Entrega rápida", text: "Prazo exato calculado pelo seu bairro no cadastro." },
      ],
    },
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
    footer: {
      legalText: "© 2026 · fullcommerce · Preencha em Configurações a razão social, CNPJ e endereço da sua empresa.",
      paymentMethods: ["Cartão de crédito", "PIX", "Boleto"],
      helpLinks: [],
      socialLinks: [],
    },
    freeShippingForCnpj: true,
    shippingCost: 19.9,
    maxInstallments: 12,
    minInstallmentValue: 5,
    interestFreeInstallments: 12,
    monthlyInterestRate: 0,
  };
}

// socialLinks era um objeto fixo ({instagram?, facebook?, ...}) antes de virar
// lista livre — sem isso, sessões que já tinham salvo redes sociais perderiam
// esse dado ao carregar a nova versão.
function migrateSocialLinks(raw: unknown): FooterLink[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, string | undefined>)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([key, url]) => ({ id: key, label: key.charAt(0).toUpperCase() + key.slice(1), url }));
  }
  return [];
}

function readSettings(): StoreSettings {
  if (typeof window === "undefined") return seedSettings();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      // Merge sobre o seed cobre sessões antigas que salvaram settings antes de
      // campos novos existirem (promotionsEnabled, siteCopy) — sem isso, ficariam undefined.
      const parsed = JSON.parse(raw);
      const merged: StoreSettings = { ...seedSettings(), ...parsed };
      merged.footer = {
        ...seedSettings().footer,
        ...parsed.footer,
        socialLinks: migrateSocialLinks(parsed.footer?.socialLinks),
      };
      return merged;
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
