import type { Category } from "@ecommerce/types";
import { categories as seedCategories } from "./data";

const STORAGE_KEY = "ecommerce.mock.categories";

function readAll(): Category[] {
  if (typeof window === "undefined") return seedCategories;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedCategories));
  return seedCategories;
}

function writeAll(categories: Category[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

export function listCategories(): Category[] {
  return readAll();
}

const DIACRITICS_RANGE = String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f);
const DIACRITICS_PATTERN = new RegExp("[" + DIACRITICS_RANGE + "]", "g");

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function createCategory(input: Omit<Category, "id">): Category {
  const categories = readAll();
  const category: Category = { ...input, slug: input.slug || slugify(input.name), id: `cat-${Date.now()}` };
  categories.push(category);
  writeAll(categories);
  return category;
}

export function updateCategory(id: string, patch: Partial<Omit<Category, "id">>): Category {
  const categories = readAll();
  const index = categories.findIndex((c) => c.id === id);
  if (index === -1) throw new Error(`Category not found: ${id}`);
  categories[index] = { ...categories[index], ...patch };
  writeAll(categories);
  return categories[index];
}

export function deleteCategory(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}
