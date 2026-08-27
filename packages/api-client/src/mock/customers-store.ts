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
  /** Endereço próprio do cliente (cadastral), quando diferente do endereço de entrega. */
  businessAddress?: Omit<Address, "id" | "isDefault">;
  regionId?: string;
};

export function createCustomer(input: CreateCustomerInput): Customer {
  const customers = readAll();
  if (customers.some((c) => c.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error("EMAIL_IN_USE");
  }
  const { address, businessAddress, ...rest } = input;
  const addresses: Address[] = [{ ...address, id: `addr-${Date.now()}`, isDefault: true, label: "Entrega" }];
  if (businessAddress) {
    addresses.push({ ...businessAddress, id: `addr-${Date.now()}-2`, isDefault: false, label: "Endereço" });
  }
  const customer: StoredCustomer = {
    ...rest,
    id: `customer-${Date.now()}`,
    code: `CLI-${1001 + customers.length}`,
    addresses,
    createdAt: new Date().toISOString(),
    status: "active",
  };
  customers.push(customer);
  writeAll(customers);
  const { password: _password, ...publicCustomer } = customer;
  return publicCustomer;
}

export function updateCustomer(id: string, patch: Partial<Omit<Customer, "id">>): Customer {
  const customers = readAll();
  const index = customers.findIndex((c) => c.id === id);
  if (index === -1) throw new Error(`Customer not found: ${id}`);
  customers[index] = { ...customers[index], ...patch };
  writeAll(customers);
  const { password: _password, ...customer } = customers[index];
  return customer;
}

export function createCustomerAddress(customerId: string, input: Omit<Address, "id">): Address {
  const customers = readAll();
  const index = customers.findIndex((c) => c.id === customerId);
  if (index === -1) throw new Error(`Customer not found: ${customerId}`);
  const address: Address = { ...input, id: `addr-${Date.now()}` };
  if (address.isDefault) customers[index].addresses.forEach((a) => (a.isDefault = false));
  customers[index].addresses.push(address);
  writeAll(customers);
  return address;
}

export function updateCustomerAddress(addressId: string, patch: Partial<Omit<Address, "id">>): Address {
  const customers = readAll();
  for (const customer of customers) {
    const address = customer.addresses.find((a) => a.id === addressId);
    if (!address) continue;
    Object.assign(address, patch);
    // Bairro do endereço padrão mudou — a região salva pode não valer mais,
    // mesma regra do backend real (resolveCustomerRegion recalcula sozinho).
    if (address.isDefault && "neighborhood" in patch) customer.regionId = undefined;
    writeAll(customers);
    return address;
  }
  throw new Error(`Address not found: ${addressId}`);
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
