import type { AdminUser, PermissionKey } from "@ecommerce/types";
import { ALL_PERMISSION_KEYS, PERMISSION_REQUIRES } from "../permissions-catalog";
import { findProfile } from "./access-profiles-store";

const STORAGE_KEY = "ecommerce.mock.teamMembers";

function readAll(): AdminUser[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(members: AdminUser[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

// Completa a pessoa com o nome do perfil e a permissão efetiva (perfil + liberadas - bloqueadas), como o backend real faz.
function decorate(member: AdminUser): AdminUser {
  if (!member.profileId) return member;
  const profile = findProfile(member.profileId);
  const set = new Set<PermissionKey>(profile?.permissions ?? []);
  for (const p of member.permissionGrants ?? []) set.add(p);
  for (const p of member.permissionRevokes ?? []) set.delete(p);
  for (const [action, needs] of Object.entries(PERMISSION_REQUIRES) as [PermissionKey, PermissionKey][]) {
    if (set.has(action) && !set.has(needs)) set.delete(action);
  }
  return { ...member, profileName: profile?.name, effectivePermissions: ALL_PERMISSION_KEYS.filter((k) => set.has(k)) };
}

export function listTeamMembers(): AdminUser[] {
  return readAll().map(decorate);
}

export function createTeamMember(input: {
  name: string;
  email: string;
  permissions?: AdminUser["permissions"];
  profileId?: string;
  sectorId?: string;
  isSupervisor?: boolean;
  isManager?: boolean;
}): AdminUser {
  const members = readAll();
  const member: AdminUser = {
    id: `staff-${Date.now()}`,
    name: input.name,
    email: input.email,
    role: "staff",
    permissions: input.profileId ? [] : input.permissions ?? [],
    profileId: input.profileId || undefined,
    permissionGrants: [],
    permissionRevokes: [],
    active: true,
    sectorId: input.sectorId || undefined,
    isSupervisor: input.isSupervisor ?? false,
    isManager: input.isManager ?? false,
  };
  members.push(member);
  writeAll(members);
  return decorate(member);
}

export function updateTeamMember(
  id: string,
  patch: Partial<{
    name: string;
    permissions: AdminUser["permissions"];
    profileId: string;
    permissionGrants: PermissionKey[];
    permissionRevokes: PermissionKey[];
    active: boolean;
    sectorId: string | null;
    isSupervisor: boolean;
    isManager: boolean;
  }>,
): AdminUser {
  const members = readAll();
  const index = members.findIndex((m) => m.id === id);
  if (index === -1) throw new Error(`Team member not found: ${id}`);
  const next = { ...members[index], ...patch } as AdminUser;
  if (patch.sectorId === null) next.sectorId = undefined;
  // Ajustes ficam sempre relativos ao perfil (igual ao servidor): só libera o que o perfil não tem, só bloqueia o que ele tem.
  if (patch.profileId !== undefined || patch.permissionGrants !== undefined || patch.permissionRevokes !== undefined) {
    const base = new Set<PermissionKey>(findProfile(next.profileId ?? "")?.permissions ?? []);
    const revokes = (next.permissionRevokes ?? []).filter((p) => base.has(p));
    next.permissionRevokes = revokes;
    next.permissionGrants = (next.permissionGrants ?? []).filter((p) => !base.has(p) && !revokes.includes(p));
    if (patch.profileId !== undefined) next.permissions = [];
  }
  members[index] = next;
  writeAll(members);
  return decorate(next);
}
