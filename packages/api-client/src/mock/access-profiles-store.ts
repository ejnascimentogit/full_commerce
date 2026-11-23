import type { AccessAuditEntry, AccessProfile, PermissionKey } from "@ecommerce/types";
import { ALL_PERMISSION_KEYS, setPermission } from "../permissions-catalog";

// Perfis de acesso do mock (só demonstração, em localStorage). No backend real vivem na tabela ecommerce.access_profiles.
const STORAGE_KEY = "ecommerce.mock.accessProfiles";
const TEAM_KEY = "ecommerce.mock.teamMembers";

type StoredProfile = Omit<AccessProfile, "memberCount">;

const SEED: StoredProfile[] = [
  {
    id: "profile-admin",
    name: "Administrador",
    description: "Acesso a todas as áreas. Configurações e Empresas continuam só do administrador da empresa.",
    permissions: [...ALL_PERMISSION_KEYS],
    isAdmin: true,
  },
  {
    id: "profile-vendedor",
    name: "Vendedor",
    description: "Atende clientes: pedidos, orçamentos, carrinhos perdidos, clientes e atividades.",
    permissions: [
      "pedidos.ver",
      "pedidos.status",
      "orcamentos.ver",
      "orcamentos.responder",
      "orcamentos.converter",
      "perdidos.ver",
      "clientes.ver",
      "clientes.editar",
      "produtos.ver",
      "promocoes.ver",
      "atividades.acessar",
    ],
    isAdmin: false,
  },
  {
    id: "profile-financeiro",
    name: "Financeiro",
    description: "Acompanha o financeiro e consulta pedidos e clientes, sem alterar nada.",
    permissions: ["financeiro.ver", "pedidos.ver", "clientes.ver"],
    isAdmin: false,
  },
  {
    id: "profile-atendimento",
    name: "Atendimento",
    description: "Responde clientes e orçamentos e acompanha pedidos, sem mexer em promoções ou conversão de orçamento.",
    permissions: [
      "pedidos.ver",
      "pedidos.status",
      "orcamentos.ver",
      "orcamentos.responder",
      "perdidos.ver",
      "clientes.ver",
      "clientes.editar",
      "produtos.ver",
      "atividades.acessar",
    ],
    isAdmin: false,
  },
];

function readAll(): StoredProfile[] {
  if (typeof window === "undefined") return SEED;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // recomeça do padrão
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
  return SEED;
}

function writeAll(profiles: StoredProfile[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

// Cada ação da lista leva junto o "ver" dela.
function withRequirements(list: readonly PermissionKey[]): PermissionKey[] {
  return list.reduce<PermissionKey[]>((acc, key) => setPermission(acc, key, true), []);
}

function memberCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  if (typeof window === "undefined") return counts;
  try {
    const members: { profileId?: string }[] = JSON.parse(localStorage.getItem(TEAM_KEY) ?? "[]");
    for (const m of members) if (m.profileId) counts.set(m.profileId, (counts.get(m.profileId) ?? 0) + 1);
  } catch {
    // sem contagem
  }
  return counts;
}

export function findProfile(id: string): StoredProfile | undefined {
  return readAll().find((p) => p.id === id);
}

export function listAccessProfiles(): AccessProfile[] {
  const counts = memberCounts();
  return readAll().map((p) => ({ ...p, memberCount: counts.get(p.id) ?? 0 }));
}

export function createAccessProfile(input: { name: string; description?: string; permissions?: PermissionKey[]; copyFromId?: string }): AccessProfile {
  const profiles = readAll();
  const name = input.name.trim();
  if (!name) throw new Error("INVALID_INPUT");
  if (profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error("DUPLICATE_PROFILE");
  const source = input.copyFromId ? profiles.find((p) => p.id === input.copyFromId) : undefined;
  const profile: StoredProfile = {
    id: `profile-${Date.now()}`,
    name,
    description: (input.description ?? "").trim(),
    permissions: source ? [...source.permissions] : withRequirements(input.permissions ?? []),
    isAdmin: false,
  };
  profiles.push(profile);
  writeAll(profiles);
  return { ...profile, memberCount: 0 };
}

export function updateAccessProfile(id: string, patch: { name?: string; description?: string; permissions?: PermissionKey[] }): AccessProfile {
  const profiles = readAll();
  const index = profiles.findIndex((p) => p.id === id);
  if (index === -1) throw new Error("NOT_FOUND");
  if (profiles[index].isAdmin) throw new Error("PROFILE_PROTECTED");
  const next = { ...profiles[index] };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("INVALID_INPUT");
    if (profiles.some((p, i) => i !== index && p.name.toLowerCase() === name.toLowerCase())) throw new Error("DUPLICATE_PROFILE");
    next.name = name;
  }
  if (patch.description !== undefined) next.description = patch.description.trim();
  if (patch.permissions !== undefined) next.permissions = withRequirements(patch.permissions);
  profiles[index] = next;
  writeAll(profiles);
  return { ...next, memberCount: memberCounts().get(id) ?? 0 };
}

export function deleteAccessProfile(id: string): void {
  const profiles = readAll();
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error("NOT_FOUND");
  if (found.isAdmin) throw new Error("PROFILE_PROTECTED");
  if ((memberCounts().get(id) ?? 0) > 0) throw new Error("PROFILE_IN_USE");
  writeAll(profiles.filter((p) => p.id !== id));
}

// O mock não guarda histórico de mudanças (só o backend real).
export function listAccessAudit(): AccessAuditEntry[] {
  return [];
}
