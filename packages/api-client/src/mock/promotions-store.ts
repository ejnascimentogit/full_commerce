import type { Promotion } from "@ecommerce/types";
import { promotions as seedPromotions } from "./data";

const STORAGE_KEY = "ecommerce.mock.promotions";

function readAll(): Promotion[] {
  if (typeof window === "undefined") return seedPromotions;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedPromotions));
  return seedPromotions;
}

function writeAll(promotions: Promotion[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(promotions));
}

export function listPromotions(): Promotion[] {
  return readAll();
}

export function createPromotion(input: Omit<Promotion, "id" | "currentUses">): Promotion {
  const promotions = readAll();
  const promotion: Promotion = { ...input, id: `promo-${Date.now()}`, currentUses: 0 };
  promotions.push(promotion);
  writeAll(promotions);
  return promotion;
}

export function updatePromotion(id: string, patch: Partial<Omit<Promotion, "id">>): Promotion {
  const promotions = readAll();
  const index = promotions.findIndex((p) => p.id === id);
  if (index === -1) throw new Error(`Promotion not found: ${id}`);
  promotions[index] = { ...promotions[index], ...patch };
  writeAll(promotions);
  return promotions[index];
}
