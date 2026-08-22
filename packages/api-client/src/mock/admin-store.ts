import type { AdminUser } from "@ecommerce/types";

// Mock-only admin users. Plain-text password for the same reason as customers-store:
// throwaway demo data, never do this in a real backend.
interface StoredAdminUser extends AdminUser {
  password: string;
}

const SEED: StoredAdminUser[] = [
  { id: "admin-platform-1", name: "Plataforma", email: "admin@plataforma.com", password: "admin123", role: "platformAdmin" },
  { id: "admin-vendor-seara", name: "Seara Distribuidora", email: "fornecedor@seara.com", password: "vendor123", role: "vendorAdmin", vendorId: "vendor-seara" },
  { id: "admin-vendor-brilux", name: "Brilux Simplifica!", email: "fornecedor@brilux.com", password: "vendor123", role: "vendorAdmin", vendorId: "vendor-brilux" },
];

const STORAGE_KEY = "ecommerce.mock.adminUsers";
const SESSION_KEY = "ecommerce.mock.session.adminUserId";

function readAll(): StoredAdminUser[] {
  if (typeof window === "undefined") return SEED;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to reseed
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
  return SEED;
}

function writeAll(users: StoredAdminUser[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

// Cria uma conta platformAdmin de verdade — pensado para o dono da loja
// substituir/complementar as contas demo. Num backend real isso deve ser
// bloqueado ou exigir convite depois que já existir um platformAdmin; aqui,
// como é mock de uma loja de dono único, fica aberto por simplicidade.
export function createAdminUser(input: { name: string; email: string; password: string }): AdminUser {
  const users = readAll();
  if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error("EMAIL_IN_USE");
  }
  const user: StoredAdminUser = {
    id: `admin-${Date.now()}`,
    name: input.name,
    email: input.email,
    password: input.password,
    role: "platformAdmin",
  };
  users.push(user);
  writeAll(users);
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export function verifyAdminPassword(email: string, password: string): AdminUser | undefined {
  const found = readAll().find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!found) return undefined;
  const { password: _password, ...user } = found;
  return user;
}

export function findAdminUserById(id: string): AdminUser | undefined {
  const found = readAll().find((u) => u.id === id);
  if (!found) return undefined;
  const { password: _password, ...user } = found;
  return user;
}

export function getAdminSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setAdminSessionUserId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, id);
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}
