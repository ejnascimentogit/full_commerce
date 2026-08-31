import type { Activity, ActivityClient, ActivityOutcome } from "@ecommerce/types";

const CLIENTS_KEY = "ecommerce.mock.activityClients";
const OUTCOMES_KEY = "ecommerce.mock.activityOutcomes";
const ACTIVITIES_KEY = "ecommerce.mock.activities";
const SEQ_KEY = "ecommerce.mock.activityCardSeq";

function readAll<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(items));
}

export function listActivityClients(): ActivityClient[] {
  return readAll(CLIENTS_KEY);
}

export function createActivityClient(input: { customerId?: string; name: string; phone?: string }): ActivityClient {
  const clients = readAll<ActivityClient>(CLIENTS_KEY);
  const client: ActivityClient = {
    id: `activity-client-${Date.now()}`,
    customerId: input.customerId,
    name: input.name,
    phone: input.phone,
    health: "green",
    createdAt: new Date().toISOString(),
  };
  clients.push(client);
  writeAll(CLIENTS_KEY, clients);
  return client;
}

export function updateActivityClient(
  id: string,
  patch: Partial<{ health: ActivityClient["health"]; healthReason: string; nextContactAt: string | null; name: string; phone: string }>,
): ActivityClient {
  const clients = readAll<ActivityClient>(CLIENTS_KEY);
  const index = clients.findIndex((c) => c.id === id);
  if (index === -1) throw new Error(`Activity client not found: ${id}`);
  const next = { ...clients[index], ...patch };
  if (patch.nextContactAt === null) next.nextContactAt = undefined;
  clients[index] = next as ActivityClient;
  writeAll(CLIENTS_KEY, clients);
  return clients[index];
}

export function listActivityOutcomes(): ActivityOutcome[] {
  return readAll(OUTCOMES_KEY);
}

export function createActivityOutcome(name: string): ActivityOutcome {
  const outcomes = readAll<ActivityOutcome>(OUTCOMES_KEY);
  const outcome: ActivityOutcome = { id: `outcome-${Date.now()}`, name, sortOrder: outcomes.length, active: true };
  outcomes.push(outcome);
  writeAll(OUTCOMES_KEY, outcomes);
  return outcome;
}

export function updateActivityOutcome(id: string, patch: Partial<ActivityOutcome>): ActivityOutcome {
  const outcomes = readAll<ActivityOutcome>(OUTCOMES_KEY);
  const index = outcomes.findIndex((o) => o.id === id);
  if (index === -1) throw new Error(`Activity outcome not found: ${id}`);
  outcomes[index] = { ...outcomes[index], ...patch };
  writeAll(OUTCOMES_KEY, outcomes);
  return outcomes[index];
}

function nextCardNumber(): number {
  if (typeof window === "undefined") return 1;
  const current = Number(localStorage.getItem(SEQ_KEY) ?? "0") + 1;
  localStorage.setItem(SEQ_KEY, String(current));
  return current;
}

export function listActivities(params?: { column?: string; assignedToAdminId?: string; clientId?: string; cardNumber?: number }): Activity[] {
  let items = readAll<Activity>(ACTIVITIES_KEY);
  if (params?.column) items = items.filter((a) => a.column === params.column);
  if (params?.assignedToAdminId) items = items.filter((a) => a.assignedToAdminId === params.assignedToAdminId);
  if (params?.clientId) items = items.filter((a) => a.clientId === params.clientId);
  if (params?.cardNumber) items = items.filter((a) => a.cardNumber === params.cardNumber);
  return items;
}

export function createActivity(input: {
  clientId: string;
  title: string;
  description?: string;
  assignedToAdminId: string;
  priority?: Activity["priority"];
  createdByAdminId: string;
}): Activity {
  const activities = readAll<Activity>(ACTIVITIES_KEY);
  const activity: Activity = {
    id: `activity-${Date.now()}`,
    cardNumber: nextCardNumber(),
    clientId: input.clientId,
    title: input.title,
    description: input.description,
    column: "urgent",
    priority: input.priority ?? "none",
    createdByAdminId: input.createdByAdminId,
    assignedToAdminId: input.assignedToAdminId,
    imageUrls: [],
    createdAt: new Date().toISOString(),
  };
  activities.push(activity);
  writeAll(ACTIVITIES_KEY, activities);
  return activity;
}

export function updateActivity(id: string, patch: Partial<Activity>): Activity {
  const activities = readAll<Activity>(ACTIVITIES_KEY);
  const index = activities.findIndex((a) => a.id === id);
  if (index === -1) throw new Error(`Activity not found: ${id}`);
  const next = { ...activities[index], ...patch };
  if (patch.column === "done") next.completedAt = new Date().toISOString();
  else if (patch.column) next.completedAt = undefined;
  activities[index] = next;
  writeAll(ACTIVITIES_KEY, activities);
  return activities[index];
}
