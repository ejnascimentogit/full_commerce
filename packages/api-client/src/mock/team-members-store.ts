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

export function createTeamMember(input: { name: string; email: string; permissions: AdminUser["permissions"]; department?: string }): AdminUser {
  const members = readAll();
  const member: AdminUser = {
    id: `staff-${Date.now()}`,
    name: input.name,
    email: input.email,
    role: "staff",
    permissions: input.permissions ?? [],
    active: true,
    department: input.department || undefined,
  };
  members.push(member);
  writeAll(members);
  return member;
}

export function updateTeamMember(id: string, patch: Partial<Pick<AdminUser, "name" | "permissions" | "active" | "department">>): AdminUser {
  const members = readAll();
  const index = members.findIndex((m) => m.id === id);
  if (index === -1) throw new Error(`Team member not found: ${id}`);
  members[index] = { ...members[index], ...patch };
  writeAll(members);
  return members[index];
}
