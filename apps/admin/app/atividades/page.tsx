"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { Activity, ActivityClient, ActivityColumn, ActivityOutcome, ActivityPriority, AdminUser, Customer, StaffSector } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

const COLUMNS: { key: ActivityColumn; label: string }[] = [
  { key: "urgent", label: "Fila de Urgências" },
  { key: "todo", label: "A Fazer" },
  { key: "doing", label: "Em Andamento" },
  { key: "done", label: "Concluído" },
];

const PRIORITY_COLOR: Record<ActivityPriority, string> = {
  none: "border-l-slate-200",
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  blue: "border-l-blue-500",
};

const PRIORITY_LABEL: Record<ActivityPriority, string> = { none: "Sem prioridade", red: "Urgente", amber: "Atenção", blue: "Normal" };

export default function AtividadesPage() {
  const { user } = useAdminAuth();
  const router = useRouter();

  const [clients, setClients] = useState<ActivityClient[]>([]);
  const [outcomes, setOutcomes] = useState<ActivityOutcome[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [people, setPeople] = useState<AdminUser[]>([]);
  const [sectors, setSectors] = useState<StaffSector[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<ActivityColumn | null>(null);
  const [pendingComplete, setPendingComplete] = useState<Activity | null>(null);
  const [pendingOutcomeId, setPendingOutcomeId] = useState("");
  const [openActivity, setOpenActivity] = useState<Activity | null>(null);

  const canAccess = user?.role === "platformAdmin" || (user?.role === "staff" && (user.permissions ?? []).includes("atividades"));

  useEffect(() => {
    if (user && !canAccess) router.replace("/");
  }, [user, canAccess, router]);

  function refresh() {
    Promise.all([
      apiClient.getActivityClients(),
      apiClient.getActivityOutcomes(),
      apiClient.getActivities(),
      apiClient.getTeamMembers(),
      apiClient.getStaffSectors(),
    ]).then(([c, o, a, staff, sec]) => {
      setClients(c);
      setOutcomes(o.filter((x) => x.active));
      setActivities(a);
      setPeople(user && user.role === "platformAdmin" ? [{ ...user, id: user.id }, ...staff] : staff);
      setSectors(sec);
      setLoading(false);
    });
    // Só quem também tem acesso a Clientes consegue buscar cliente real — se não tiver,
    // a lista fica vazia e o formulário só permite cadastrar lead novo, sem quebrar a tela.
    apiClient
      .getAdminCustomers()
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }

  useEffect(() => {
    if (canAccess) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const sectorById = useMemo(() => new Map(sectors.map((s) => [s.id, s])), [sectors]);

  // Filtro de setor só faz sentido pra quem enxerga mais de um setor —
  // platformAdmin, gerente, ou quem está num setor "vê tudo" (ex: Diretoria).
  const ownSectorSeesAll = user?.sectorId ? sectorById.get(user.sectorId)?.seesAll : false;
  const hasBroadVisibility = user?.role === "platformAdmin" || user?.isManager || ownSectorSeesAll;

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (filterAssignee && a.assignedToAdminId !== filterAssignee) return false;
      if (filterSector) {
        const assigneeSectorId = personById.get(a.assignedToAdminId)?.sectorId;
        if (assigneeSectorId !== filterSector) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const client = clientById.get(a.clientId);
        const matchesNumber = String(a.cardNumber).includes(q);
        const matchesTitle = a.title.toLowerCase().includes(q);
        const matchesClient = client?.name.toLowerCase().includes(q);
        if (!matchesNumber && !matchesTitle && !matchesClient) return false;
      }
      return true;
    });
  }, [activities, filterAssignee, filterSector, search, clientById, personById]);

  async function moveActivity(activity: Activity, column: ActivityColumn) {
    if (column === "done") {
      setPendingComplete(activity);
      setPendingOutcomeId("");
      return;
    }
    await apiClient.updateActivity(activity.id, { column });
    refresh();
  }

  async function confirmComplete() {
    if (!pendingComplete || !pendingOutcomeId) return;
    await apiClient.updateActivity(pendingComplete.id, { column: "done", outcomeId: pendingOutcomeId });
    setPendingComplete(null);
    refresh();
  }

  if (!canAccess) return null;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Atividades</h1>
          <p className="text-sm text-slate-500 mt-1">Arraste os cards entre as colunas conforme o atendimento avança.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/atividades/clientes" className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 py-2 hover:bg-brand-50">
            Clientes
          </Link>
          <Link href="/atividades/desempenho" className="text-sm text-brand-600 border border-brand-200 rounded-md px-3 py-2 hover:bg-brand-50">
            Desempenho
          </Link>
          <button type="button" onClick={() => setShowCreate(true)} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700">
            + Nova atividade
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número, título ou cliente..."
          className="border border-slate-300 rounded-md px-3 py-2 text-sm w-72"
        />
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
          <option value="">Todos os responsáveis</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {hasBroadVisibility && (
          <select value={filterSector} onChange={(e) => setFilterSector(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">Todos os setores</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Carregando...</p>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const items = filtered.filter((a) => a.column === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumn(col.key);
                }}
                onDragLeave={() => setDragOverColumn((c) => (c === col.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColumn(null);
                  const activityId = e.dataTransfer.getData("text/activity-id");
                  const activity = activities.find((a) => a.id === activityId);
                  if (activity && activity.column !== col.key) moveActivity(activity, col.key);
                }}
                className={`bg-slate-100 border rounded-lg p-3 min-h-[300px] ${dragOverColumn === col.key ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-300"}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-700">{col.label}</h2>
                  <span className="text-xs font-mono text-slate-400 bg-white border border-slate-200 rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((activity) => {
                    const client = clientById.get(activity.clientId);
                    const assignee = personById.get(activity.assignedToAdminId);
                    return (
                      <div
                        key={activity.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/activity-id", activity.id)}
                        onClick={() => setOpenActivity(activity)}
                        className={`bg-white border border-slate-200 border-l-4 ${PRIORITY_COLOR[activity.priority]} rounded-md p-3 shadow-md hover:shadow-lg transition-shadow cursor-grab active:cursor-grabbing`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-slate-400">#{activity.cardNumber}</span>
                          {activity.imageUrls.length > 0 && <span className="text-[10px] text-slate-400">📎 {activity.imageUrls.length}</span>}
                        </div>
                        <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{client?.name ?? "Cliente removido"}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{PRIORITY_LABEL[activity.priority]}</span>
                          {assignee && <span className="text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded">{assignee.name}</span>}
                        </div>
                        {/* Alternativa ao arrastar — em notebook/trackpad o drag nativo do navegador
                            costuma ser difícil de acertar, então sempre dá pra mover pelo seletor. */}
                        <select
                          value={activity.column}
                          onChange={(e) => moveActivity(activity, e.target.value as ActivityColumn)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full mt-2 border border-slate-200 rounded-md px-2 py-1 text-xs bg-slate-50 text-slate-600"
                        >
                          {COLUMNS.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Nenhum card aqui.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateActivityModal
          clients={clients}
          customers={customers}
          people={people}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}

      {openActivity && (
        <ActivityDetailModal
          activity={openActivity}
          client={clientById.get(openActivity.clientId)}
          people={people}
          onClose={() => setOpenActivity(null)}
          onUpdated={(updated) => {
            setOpenActivity(updated);
            refresh();
          }}
        />
      )}

      {pendingComplete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="font-semibold text-slate-900 mb-1">Concluir atividade</h3>
            <p className="text-sm text-slate-500 mb-4">Qual foi o resultado do card #{pendingComplete.cardNumber}?</p>
            <select
              value={pendingOutcomeId}
              onChange={(e) => setPendingOutcomeId(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white mb-4"
            >
              <option value="">Selecione o resultado...</option>
              {outcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {outcomes.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-md p-2 mb-4">
                Nenhum resultado cadastrado ainda — cadastre em Configurações → Status de conclusão de atividades.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingComplete(null)} className="text-sm text-slate-600 px-3 py-2">
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmComplete}
                disabled={!pendingOutcomeId}
                className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function CreateActivityModal({
  clients,
  customers,
  people,
  onClose,
  onCreated,
}: {
  clients: ActivityClient[];
  customers: Customer[];
  people: AdminUser[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "lead">("existing");
  const [clientId, setClientId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToAdminId, setAssignedToAdminId] = useState(people[0]?.id ?? "");
  const [priority, setPriority] = useState<ActivityPriority>("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !assignedToAdminId) return;
    setSubmitting(true);
    try {
      let resolvedClientId = clientId;
      if (mode === "existing" && !clientId && customerId) {
        const customer = customers.find((c) => c.id === customerId);
        const created = await apiClient.createActivityClient({ customerId, name: customer?.name ?? "Cliente", phone: customer?.phone });
        resolvedClientId = created.id;
      } else if (mode === "lead") {
        if (!leadName.trim()) {
          setError("Informe o nome do lead.");
          setSubmitting(false);
          return;
        }
        const created = await apiClient.createActivityClient({ name: leadName.trim(), phone: leadPhone.trim() || undefined });
        resolvedClientId = created.id;
      }
      if (!resolvedClientId) {
        setError("Escolha um cliente ou cadastre um lead.");
        setSubmitting(false);
        return;
      }
      await apiClient.createActivity({ clientId: resolvedClientId, title: title.trim(), description: description.trim() || undefined, assignedToAdminId, priority });
      onCreated();
    } catch {
      setError("Não foi possível criar a atividade.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
        <h3 className="font-semibold text-slate-900">Nova atividade</h3>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Cliente</label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`flex-1 text-sm rounded-md px-3 py-1.5 border ${mode === "existing" ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-300 text-slate-600"}`}
            >
              Cliente existente
            </button>
            <button
              type="button"
              onClick={() => setMode("lead")}
              className={`flex-1 text-sm rounded-md px-3 py-1.5 border ${mode === "lead" ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-300 text-slate-600"}`}
            >
              Novo lead
            </button>
          </div>
          {mode === "existing" ? (
            <div className="space-y-2">
              {clients.length > 0 && (
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
                  <option value="">Já cadastrado no quadro...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">Buscar na base de clientes da loja...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {customers.length === 0 && clients.length === 0 && <p className="text-xs text-slate-400">Sem clientes cadastrados — use &quot;Novo lead&quot;.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Nome" className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
              <input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="Telefone (opcional)" className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
            <select required value={assignedToAdminId} onChange={(e) => setAssignedToAdminId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as ActivityPriority)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="none">Sem prioridade</option>
              <option value="blue">Normal</option>
              <option value="amber">Atenção</option>
              <option value="red">Urgente</option>
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm text-slate-600 px-3 py-2">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
            {submitting ? "Criando..." : "Criar atividade"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ActivityDetailModal({
  activity,
  client,
  people,
  onClose,
  onUpdated,
}: {
  activity: Activity;
  client?: ActivityClient;
  people: AdminUser[];
  onClose: () => void;
  onUpdated: (updated: Activity) => void;
}) {
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description ?? "");
  const [assignedToAdminId, setAssignedToAdminId] = useState(activity.assignedToAdminId);
  const [priority, setPriority] = useState<ActivityPriority>(activity.priority);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updated = await apiClient.updateActivity(activity.id, { title: title.trim(), description: description.trim() || undefined, assignedToAdminId, priority });
    setSaving(false);
    onUpdated(updated);
  }

  async function addImages(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map((f) => apiClient.uploadActivityImage(f)));
      const updated = await apiClient.updateActivity(activity.id, { imageUrls: [...activity.imageUrls, ...urls] });
      onUpdated(updated);
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(url: string) {
    const updated = await apiClient.updateActivity(activity.id, { imageUrls: activity.imageUrls.filter((u) => u !== url) });
    onUpdated(updated);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length > 0) {
      e.preventDefault();
      addImages(files);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto" onPaste={handlePaste}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">
            Card #{activity.cardNumber} <span className="text-slate-400 font-normal">· {client?.name ?? "Cliente removido"}</span>
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
            <select value={assignedToAdminId} onChange={(e) => setAssignedToAdminId(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as ActivityPriority)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="none">Sem prioridade</option>
              <option value="blue">Normal</option>
              <option value="amber">Atenção</option>
              <option value="red">Urgente</option>
            </select>
          </div>
        </div>

        <button type="button" onClick={handleSave} disabled={saving} className="w-full bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>

        <div className="border-t border-slate-100 pt-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Imagens (prints, fotos que o cliente mandou)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {activity.imageUrls.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL vinda do storage/data-uri, não do next/image loader */}
                <img src={url} alt="Anexo" className="w-16 h-16 object-cover rounded-md border border-slate-200" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <label className="block text-xs text-brand-600 border border-dashed border-brand-300 rounded-md px-3 py-3 text-center cursor-pointer hover:bg-brand-50">
            {uploading ? "Enviando..." : "+ Adicionar do computador, ou cole (Ctrl+V) um print aqui"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                addImages(files);
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
