import type { Vendor } from "@ecommerce/types";
import { vendors as seedVendors } from "./data";

const STORAGE_KEY = "ecommerce.mock.vendors";

function readAll(): Vendor[] {
  if (typeof window === "undefined") return seedVendors;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedVendors));
  return seedVendors;
}

function writeAll(vendors: Vendor[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vendors));
}

export function listVendors(): Vendor[] {
  return readAll();
}

export function createVendor(input: Omit<Vendor, "id">): Vendor {
  const vendors = readAll();
  const vendor: Vendor = { ...input, id: `vendor-${Date.now()}` };
  vendors.push(vendor);
  writeAll(vendors);
  return vendor;
}

export function updateVendor(id: string, patch: Partial<Omit<Vendor, "id">>): Vendor {
  const vendors = readAll();
  const index = vendors.findIndex((v) => v.id === id);
  if (index === -1) throw new Error(`Vendor not found: ${id}`);
  vendors[index] = { ...vendors[index], ...patch };
  writeAll(vendors);
  return vendors[index];
}
