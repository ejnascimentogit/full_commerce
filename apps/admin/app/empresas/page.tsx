"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@ecommerce/api-client";
import type { Company, CompanyProfile, EcommerceType } from "@ecommerce/types";
import { AdminShell } from "@/components/AdminShell";
import { useAdminAuth } from "@/lib/admin-auth-context";

// O cliente REST só devolve o código do erro (ex: COMPANY_HAS_DATA) — aqui vira texto pra pessoa.
const ERRO_MENSAGEM: Record<string, string> = {
  COMPANY_HAS_DATA:
    'Essa empresa já tem dados cadastrados (clientes, produtos, pedidos etc.) e não pode ser excluída. Para tirá-la do ar sem perder nada, use "Editar domínio" e desmarque "Empresa ativa".',
  COMPANY_PROTECTED: "A empresa 1 (Full-Commerce) não pode ser excluída.",
  COMPANY_NOT_FOUND: "Empresa não encontrada — atualize a página.",
  INVALID_DOCUMENT: "CNPJ inválido. Confira os números.",
  INVALID_INPUT: "Confira os dados informados (nome e identificador são obrigatórios).",
  DB_ERROR: "Não foi possível salvar — o identificador (slug) pode já estar em uso por outra empresa.",
};

function mensagemDeErro(e: unknown): string {
  const codigo = e instanceof Error ? e.message : "";
  return ERRO_MENSAGEM[codigo] ?? "Não foi possível concluir a operação. Tente novamente.";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function EmpresasPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingData, setEditingData] = useState<Company | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (user && !user.isPlatformOwner) router.replace("/");
  }, [user, router]);

  function refresh() {
    apiClient.getCompanies().then(setCompanies);
  }

  useEffect(refresh, []);

  async function handleDelete(company: Company) {
    const ok = window.confirm(
      `Excluir a empresa "${company.name}" (filial ${company.branchCode})?\n\nSó é possível excluir empresa que ainda não tem nenhum dado (clientes, produtos, pedidos...). Essa ação não pode ser desfeita.`,
    );
    if (!ok) return;
    try {
      await apiClient.deleteCompany(company.id);
      refresh();
    } catch (e) {
      alert(mensagemDeErro(e));
    }
  }

  if (!user?.isPlatformOwner) return null;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700"
        >
          + Nova empresa
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Cada empresa tem seus próprios produtos, fornecedores, clientes e configurações — totalmente isolados das outras.
        Só quem entra pela empresa 1 vê e altera o cadastro das empresas.
      </p>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Filial</th>
              <th className="text-left px-4 py-2.5">Tipo</th>
              <th className="text-left px-4 py-2.5">Domínio (loja)</th>
              <th className="text-left px-4 py-2.5">Domínio (admin)</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  <span className="inline-block min-w-6 text-center font-mono text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 mr-2">
                    {c.branchCode ?? "—"}
                  </span>
                  {c.name}
                  {c.profile?.cnpj && <span className="block text-xs font-normal text-slate-400 pl-9">CNPJ {c.profile.cnpj}</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.ecommerceType === "televendas" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                    {c.ecommerceType === "televendas" ? "Televendas" : "Multi-fornecedor"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{c.domain ?? <span className="text-amber-600">não configurado</span>}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.adminDomain ?? <span className="text-amber-600">não configurado</span>}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.active ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-4">
                  <button type="button" onClick={() => setEditingData(c)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    Dados
                  </button>
                  <button type="button" onClick={() => setEditingCompany(c)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    Editar domínio
                  </button>
                  {c.branchCode !== 1 && (
                    <button type="button" onClick={() => handleDelete(c)} className="text-xs font-semibold text-red-600 hover:text-red-700">
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <CompanyFormModal
          company={null}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            refresh();
          }}
        />
      )}

      {editingData && (
        <CompanyFormModal
          company={editingData}
          onClose={() => setEditingData(null)}
          onSaved={() => {
            setEditingData(null);
            refresh();
          }}
        />
      )}

      {editingCompany && (
        <EditCompanyModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          onSaved={() => {
            setEditingCompany(null);
            refresh();
          }}
        />
      )}
    </AdminShell>
  );
}

const inputClass = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

interface FormState {
  name: string;
  slug: string;
  ecommerceType: EcommerceType;
  legalName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  email: string;
  phone: string;
  responsibleName: string;
  responsiblePhone: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

function toForm(company: Company | null): FormState {
  const p = company?.profile ?? {};
  const a = p.address ?? {};
  return {
    name: company?.name ?? "",
    slug: company?.slug ?? "",
    ecommerceType: company?.ecommerceType ?? "wholesale",
    legalName: p.legalName ?? "",
    tradeName: p.tradeName ?? "",
    cnpj: p.cnpj ?? "",
    stateRegistration: p.stateRegistration ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    responsibleName: p.responsibleName ?? "",
    responsiblePhone: p.responsiblePhone ?? "",
    zipCode: a.zipCode ?? "",
    street: a.street ?? "",
    number: a.number ?? "",
    complement: a.complement ?? "",
    neighborhood: a.neighborhood ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
  };
}

function toProfile(f: FormState): CompanyProfile {
  return {
    legalName: f.legalName,
    tradeName: f.tradeName,
    cnpj: f.cnpj,
    stateRegistration: f.stateRegistration,
    email: f.email,
    phone: f.phone,
    responsibleName: f.responsibleName,
    responsiblePhone: f.responsiblePhone,
    address: {
      zipCode: f.zipCode,
      street: f.street,
      number: f.number,
      complement: f.complement,
      neighborhood: f.neighborhood,
      city: f.city,
      state: f.state,
    },
  };
}

// Cadastro completo da empresa: serve pra criar (company = null) e pra editar os dados de uma já existente.
function CompanyFormModal({ company, onClose, onSaved }: { company: Company | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = company !== null;
  const [form, setForm] = useState<FormState>(() => toForm(company));
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleNameChange(value: string) {
    setForm((prev) => ({ ...prev, name: value, slug: isEdit ? prev.slug : slugify(value) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const profile = toProfile(form);
      if (company) {
        await apiClient.updateCompany(company.id, { name: form.name.trim(), profile });
      } else {
        await apiClient.createCompany({ name: form.name.trim(), slug: form.slug.trim(), ecommerceType: form.ecommerceType, profile });
      }
      onSaved();
    } catch (err) {
      alert(mensagemDeErro(err));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? `Dados da empresa — filial ${company.branchCode}` : "Nova empresa"}
          </h2>
          {!isEdit && (
            <p className="text-xs text-slate-500 mt-1">
              O código da filial é gerado sozinho (o próximo número livre). O domínio da loja/admin é configurado depois, em "Editar
              domínio", quando o cliente tiver o domínio próprio pronto.
            </p>
          )}
        </div>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Identificação</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome da empresa *">
              <input required value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ex: Odoya" className={inputClass} />
            </Field>
            <Field label="Identificador interno (slug) *">
              <input
                required
                disabled={isEdit}
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                className={`${inputClass} font-mono disabled:bg-slate-50 disabled:text-slate-500`}
              />
            </Field>
            <Field label="Razão social">
              <input value={form.legalName} onChange={(e) => set("legalName", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Nome fantasia">
              <input value={form.tradeName} onChange={(e) => set("tradeName", e.target.value)} className={inputClass} />
            </Field>
            <Field label="CNPJ">
              <input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" className={inputClass} />
            </Field>
            <Field label="Inscrição estadual">
              <input value={form.stateRegistration} onChange={(e) => set("stateRegistration", e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Tipo de e-commerce">
            <select
              disabled={isEdit}
              value={form.ecommerceType}
              onChange={(e) => set("ecommerceType", e.target.value as EcommerceType)}
              className={`${inputClass} bg-white disabled:bg-slate-50 disabled:text-slate-500`}
            >
              <option value="wholesale">Multi-fornecedor (padrão) — atacado B2B, como Odoya</option>
              <option value="televendas">Televendas — varejo B2C com crediário próprio</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Não pode ser trocado depois de criar a empresa — define quais telas do admin e qual loja essa empresa usa.
            </p>
          </Field>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Contato e responsável</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="E-mail da empresa">
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Telefone da empresa">
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 0000-0000" className={inputClass} />
            </Field>
            <Field label="Nome do responsável">
              <input value={form.responsibleName} onChange={(e) => set("responsibleName", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Telefone / WhatsApp do responsável">
              <input value={form.responsiblePhone} onChange={(e) => set("responsiblePhone", e.target.value)} placeholder="(00) 00000-0000" className={inputClass} />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Endereço</h3>
          <div className="grid sm:grid-cols-6 gap-4">
            <Field label="CEP" className="sm:col-span-2">
              <input value={form.zipCode} onChange={(e) => set("zipCode", e.target.value)} placeholder="00000-000" className={inputClass} />
            </Field>
            <Field label="Rua" className="sm:col-span-3">
              <input value={form.street} onChange={(e) => set("street", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Número" className="sm:col-span-1">
              <input value={form.number} onChange={(e) => set("number", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Complemento" className="sm:col-span-2">
              <input value={form.complement} onChange={(e) => set("complement", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Bairro" className="sm:col-span-2">
              <input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Cidade" className="sm:col-span-1">
              <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputClass} />
            </Field>
            <Field label="UF" className="sm:col-span-1">
              <input maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} className={inputClass} />
            </Field>
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Salvando..." : isEdit ? "Salvar dados" : "Criar empresa"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditCompanyModal({ company, onClose, onSaved }: { company: Company; onClose: () => void; onSaved: () => void }) {
  const [domain, setDomain] = useState(company.domain ?? "");
  const [adminDomain, setAdminDomain] = useState(company.adminDomain ?? "");
  const [active, setActive] = useState(company.active);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await apiClient.updateCompany(company.id, { domain: domain.trim(), adminDomain: adminDomain.trim(), active });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Domínio — {company.name}</h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Domínio da loja</label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="ex: odoya.com.br"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Domínio do admin</label>
          <input
            value={adminDomain}
            onChange={(e) => setAdminDomain(e.target.value)}
            placeholder="ex: admin.odoya.com.br"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>
        <p className="text-xs text-slate-500">
          Sem o "https://", só o host. Precisa apontar de verdade pro Worker no Cloudflare pra funcionar — isso aqui só ensina
          o backend a reconhecer o domínio.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Empresa ativa
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="bg-brand-600 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
