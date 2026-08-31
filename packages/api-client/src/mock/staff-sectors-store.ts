import type { StaffSector } from "@ecommerce/types";

const STORAGE_KEY = "ecommerce.mock.staffSectors";

function readAll(): StaffSector[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(sectors: StaffSector[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sectors));
}

export function listStaffSectors(): StaffSector[] {
  return readAll();
}

export function createStaffSector(name: string): StaffSector {
  const sectors = readAll();
  const sector: StaffSector = { id: `sector-${Date.now()}`, name };
  sectors.push(sector);
  writeAll(sectors);
  return sector;
}

export function deleteStaffSector(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}
