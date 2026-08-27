import type { Product } from "@ecommerce/types";
import { products as seedProducts } from "./data";

// Mutable product catalog for mock mode, persisted to localStorage and seeded from
// the static demo catalog in data.ts. This is what admin's product CRUD writes to;
// the storefront's read-only queries (getProducts/getProduct) read from here too so
// a product created/edited in the admin app shows up immediately in the storefront.
const STORAGE_KEY = "ecommerce.mock.products";

function readAll(): Product[] {
  if (typeof window === "undefined") return seedProducts;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedProducts));
  return seedProducts;
}

function writeAll(products: Product[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

export function listProducts(): Product[] {
  return readAll();
}

export function findProductById(id: string): Product | undefined {
  return readAll().find((p) => p.id === id);
}

export function createProduct(input: Omit<Product, "id" | "sku">): Product {
  const products = readAll();
  // Mock é sempre a "empresa 1" (só existe uma) — mesmo padrão {empresa}{sequencial de
  // 5 dígitos} do backend real, só que contado localmente já que não há banco aqui.
  const sku = `1${String(products.length + 1).padStart(5, "0")}`;
  const product: Product = { ...input, id: `product-${Date.now()}`, sku };
  products.push(product);
  writeAll(products);
  return product;
}

export function updateProduct(id: string, patch: Partial<Omit<Product, "id" | "sku">>): Product {
  const products = readAll();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) throw new Error(`Product not found: ${id}`);
  products[index] = { ...products[index], ...patch };
  writeAll(products);
  return products[index];
}
