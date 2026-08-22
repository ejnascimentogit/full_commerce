import type { DeliveryRegion } from "@ecommerce/types";
import { regions as seedRegions } from "./data";

const STORAGE_KEY = "ecommerce.mock.regions";

function readAll(): DeliveryRegion[] {
  if (typeof window === "undefined") return seedRegions;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedRegions));
  return seedRegions;
}

function writeAll(regions: DeliveryRegion[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(regions));
}

export function listRegions(): DeliveryRegion[] {
  return readAll();
}

export function createRegion(input: Omit<DeliveryRegion, "id">): DeliveryRegion {
  const regions = readAll();
  const region: DeliveryRegion = { ...input, id: `region-${Date.now()}` };
  regions.push(region);
  writeAll(regions);
  return region;
}

export function updateRegion(id: string, patch: Partial<Omit<DeliveryRegion, "id">>): DeliveryRegion {
  const regions = readAll();
  const index = regions.findIndex((r) => r.id === id);
  if (index === -1) throw new Error(`Region not found: ${id}`);
  regions[index] = { ...regions[index], ...patch };
  writeAll(regions);
  return regions[index];
}
