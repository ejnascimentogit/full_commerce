import type { Address, Customer } from "@ecommerce/types";
import { mockCustomer } from "./data";

// Mock-only "database" of customers, persisted to localStorage so register/login
// survive reloads. Password is stored in plain text here ONLY because this is a
// throwaway frontend mock with no real security stakes — a real backend must hash
// passwords (bcrypt/argon2) and never keep this file's shape.
interface StoredCustomer extends Customer {
  password: string;
}

const STORAGE_KEY = "ecommerce.mock.customers";

function seedIfEmpty(): StoredCustomer[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed
    }
  }
  const seeded: StoredCustomer[] = [{ ...mockCustomer, password: "demo123" }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function readAll(): StoredCustomer[] {
  if (typeof window === "undefined") return [];
  return seedIfEmpty();
}

function writeAll(customers: StoredCustomer[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

export function findByEmail(email: string): StoredCustomer | undefined {
  return readAll().find((c) => c.email.toLowerCase() === email.toLowerCase());
}

export function listAll(): Customer[] {
  return readAll().map(({ password: _password, ...customer }) => customer);
}

export function findById(id: string): Customer | undefined {
  const found = readAll().find((c) => c.id === id);
  if (!found) return undefined;
  const { password: _password, ...customer } = found;
  return customer;
}

type CreateCustomerInput = Omit<StoredCustomer, "id" | "addresses" | "createdAt" | "status" | "regionId"> & {
  address: Omit<Address, "id" | "isDefault">;
  regionId?: string;
};

export function createCustomer(input: CreateCustomerInput): Customer {
  const customers = readAll();
  if (customers.some((c) => c.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error("EMAIL_IN_USE");
  }
  const { address, ...rest } = input;
  const customer: StoredCustomer = {
    ...rest,
    id: `customer-${Date.now()}`,
    code: `CLI-${1001 + customers.length}`,
    addresses: [{ ...address, id: `addr-${Date.now()}`, isDefault: true }],
    createdAt: new Date().toISOString(),
    status: "active",
  };
  customers.push(customer);
  writeAll(customers);
  const { password: _password, ...publicCustomer } = customer;
  return publicCustomer;
}

export function verifyPassword(email: string, password: string): Customer | undefined {
  const found = findByEmail(email);
  if (!found || found.password !== password) return undefined;
  const { password: _password, ...customer } = found;
  return customer;
}

export function resetPassword(email: string, newPassword: string): boolean {
  const customers = readAll();
  const index = customers.findIndex((c) => c.email.toLowerCase() === email.toLowerCase());
  if (index === -1) return false;
  customers[index] = { ...customers[index], password: newPassword };
  writeAll(customers);
  return true;
}
