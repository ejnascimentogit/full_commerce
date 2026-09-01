import type { AdminUser } from "@ecommerce/types";

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

export function listTeamMembers(): AdminUser[] {
  return readAll();
}

export function createTeamMember(input: {
  name: string;
  email: string;
  permissions: AdminUser["permissions"];
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
    permissions: input.permissions ?? [],
    active: true,
    sectorId: input.sectorId || undefined,
    isSupervisor: input.isSupervisor ?? false,
    isManager: input.isManager ?? false,
  };
  members.push(member);
  writeAll(members);
  return member;
}

export function updateTeamMember(
  id: string,
  patch: Partial<{
    name: string;
    permissions: AdminUser["permissions"];
    active: boolean;
    sectorId: string | null;
    isSupervisor: boolean;
    isManager: boolean;
  }>,
): AdminUser {
  const members = readAll();
  const index = members.findIndex((m) => m.id === id);
  if (index === -1) throw new Error(`Team member not found: ${id}`);
  const next = { ...members[index], ...patch };
  if (patch.sectorId === null) next.sectorId = undefined;
  members[index] = next as AdminUser;
  writeAll(members);
  return members[index];
}
